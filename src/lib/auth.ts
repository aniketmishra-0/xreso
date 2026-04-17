import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { compareSync } from "bcryptjs";
import { randomUUID } from "crypto";
import { createClient } from "@libsql/client/web";
import { logAuthEvent } from "@/lib/auth-events";
import { isRateLimited, loginLimiter } from "@/lib/ratelimit";

function getTursoClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });
}
type AppRole = "user" | "admin" | "moderator";

type AppUserRow = {
  id: string;
  name: string;
  email: string;
  password: string | null;
  role: string;
  avatar: string | null;
  premium_access: number;
  premium_expires_at: string | null;
};

function getOAuthEnvValue(primaryKey: string, legacyKey: string) {
  const value = process.env[primaryKey] || process.env[legacyKey] || "";
  return value.trim();
}

const GOOGLE_CLIENT_ID = getOAuthEnvValue("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = getOAuthEnvValue(
  "AUTH_GOOGLE_SECRET",
  "GOOGLE_CLIENT_SECRET"
);
const GITHUB_CLIENT_ID = getOAuthEnvValue("AUTH_GITHUB_ID", "GITHUB_CLIENT_ID");
const GITHUB_CLIENT_SECRET = getOAuthEnvValue(
  "AUTH_GITHUB_SECRET",
  "GITHUB_CLIENT_SECRET"
);
const LINKEDIN_CLIENT_ID = getOAuthEnvValue("AUTH_LINKEDIN_ID", "LINKEDIN_CLIENT_ID");
const LINKEDIN_CLIENT_SECRET = getOAuthEnvValue(
  "AUTH_LINKEDIN_SECRET",
  "LINKEDIN_CLIENT_SECRET"
);

function normalizeRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "moderator") {
    return role;
  }

  return "user";
}

function hasActivePremiumEntitlement(
  premiumAccess: number | boolean | null | undefined,
  premiumExpiresAt: string | null | undefined
) {
  if (!premiumAccess) return false;
  if (!premiumExpiresAt) return true;

  const expiryTime = Date.parse(premiumExpiresAt);
  if (Number.isNaN(expiryTime)) {
    return false;
  }

  return expiryTime > Date.now();
}

function getFallbackOAuthEmail(account: {
  provider?: string | null;
  providerAccountId?: string | null;
}) {
  const provider =
    typeof account.provider === "string" ? account.provider.trim().toLowerCase() : "";
  const providerAccountId =
    typeof account.providerAccountId === "string"
      ? account.providerAccountId.trim()
      : "";

  if (!provider || !providerAccountId) {
    return "";
  }

  const safeProviderAccountId = providerAccountId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${provider}_${safeProviderAccountId}@oauth.xreso.local`;
}

async function getDbUserByEmail(email: string): Promise<AppUserRow | null> {
  const client = getTursoClient();

  try {
    const result = await client.execute({
      sql: "SELECT id, name, email, password, role, avatar, premium_access, premium_expires_at FROM users WHERE lower(email) = lower(?) LIMIT 1",
      args: [email]
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as AppUserRow;
  } catch {
    return null;
  }
}

async function upsertOAuthUserInDb(data: {
  name?: string | null;
  email: string;
  image?: string | null;
}): Promise<AppUserRow | null> {
  const normalizedEmail = data.email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const client = getTursoClient();

  try {
    const res = await client.execute({
      sql: "SELECT id, name, email, password, role, avatar, premium_access, premium_expires_at FROM users WHERE lower(email) = lower(?) LIMIT 1",
      args: [normalizedEmail]
    });
    const existing = res.rows.length > 0 ? (res.rows[0] as unknown as AppUserRow) : null;

    if (existing) {
      const resolvedName =
        typeof data.name === "string" && data.name.trim()
          ? data.name.trim()
          : existing.name;
      const resolvedAvatar =
        typeof data.image === "string" && data.image.trim()
          ? data.image.trim()
          : existing.avatar;

      if (resolvedName !== existing.name || resolvedAvatar !== existing.avatar) {
        await client.execute({
          sql: "UPDATE users SET name = ?, avatar = ?, updated_at = datetime('now') WHERE id = ?",
          args: [resolvedName, resolvedAvatar, existing.id]
        });
      }

      return {
        ...existing,
        name: resolvedName,
        avatar: resolvedAvatar,
      };
    }

    const generatedName =
      typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : normalizedEmail.split("@")[0] || "User";
    const avatar =
      typeof data.image === "string" && data.image.trim() ? data.image.trim() : null;
    const userId = randomUUID();

    await client.execute({
      sql: "INSERT INTO users (id, name, email, password, avatar, role, premium_access, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, 'user', 0, datetime('now'), datetime('now'))",
      args: [userId, generatedName, normalizedEmail, avatar]
    });

    return {
      id: userId,
      name: generatedName,
      email: normalizedEmail,
      password: null,
      role: "user",
      avatar,
      premium_access: 0,
      premium_expires_at: null,
    };
  } catch (error) {
    console.error("[auth] Failed to upsert OAuth user in database", error);
    return null;
  }
}

const providers: Provider[] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, request) {
      if (!credentials?.email || !credentials?.password) return null;

      const normalizedEmail = String(credentials.email).trim().toLowerCase();
      const providedPassword = String(credentials.password);
      if (!normalizedEmail || !providedPassword) return null;

      const forwarded = request?.headers?.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || "anonymous";
      const rateLimitKey = `credentials:${normalizedEmail}:${ip}`;

      if (await isRateLimited(rateLimitKey, loginLimiter)) {
        return null;
      }

      const user = await getDbUserByEmail(normalizedEmail);

      if (!user || !user.password) return null;
      const isValid = compareSync(providedPassword, user.password);
      if (!isValid) return null;

      const premium = hasActivePremiumEntitlement(
        user.premium_access,
        user.premium_expires_at
      );
      const role = normalizeRole(user.role);

      await logAuthEvent({
        eventType: "login",
        userId: user.id,
        email: user.email,
        provider: "credentials",
        ipAddress: ip,
        metadata: {
          role,
          premium,
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        image: user.avatar,
        premium,
        premiumExpiresAt: user.premium_expires_at,
      };
    },
  }),
];

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    })
  );
}

if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
    })
  );
}

if (LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET) {
  providers.push(
    LinkedIn({
      clientId: LINKEDIN_CLIENT_ID,
      clientSecret: LINKEDIN_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;

      const normalizedEmail =
        typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
      const fallbackEmail = getFallbackOAuthEmail({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });
      const resolvedEmail = normalizedEmail || fallbackEmail;
      if (!resolvedEmail) return false;

      // OAuth always auto-creates user if they don't exist
      const syncedUser = await upsertOAuthUserInDb({
        email: resolvedEmail,
        name: user.name,
        image: user.image,
      });

      if (!syncedUser) return false;

      const premium = hasActivePremiumEntitlement(
        syncedUser.premium_access,
        syncedUser.premium_expires_at
      );
      const mutableUser = user as {
        id?: string;
        email?: string | null;
        name?: string | null;
        image?: string | null;
        role?: AppRole;
        premium?: boolean;
        premiumExpiresAt?: string | null;
      };

      mutableUser.id = syncedUser.id;
      mutableUser.email = syncedUser.email;
      mutableUser.name = syncedUser.name;
      mutableUser.image = syncedUser.avatar;
      mutableUser.role = normalizeRole(syncedUser.role);
      mutableUser.premium = premium;
      mutableUser.premiumExpiresAt = syncedUser.premium_expires_at;

      await logAuthEvent({
        eventType: "oauth_login",
        userId: syncedUser.id,
        email: syncedUser.email,
        provider: account.provider || "oauth",
        metadata: {
          role: mutableUser.role,
          premium,
        },
      });

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = normalizeRole((user as { role?: string }).role);
        token.picture = (user as { image?: string | null }).image || null;
        token.name = typeof user.name === "string" ? user.name : undefined;
        token.premium = (user as { premium?: boolean }).premium === true;
        token.premiumExpiresAt =
          (user as { premiumExpiresAt?: string | null }).premiumExpiresAt || null;
      }

      const tokenEmail = typeof token.email === "string" ? token.email.trim().toLowerCase() : "";
      const shouldHydrateToken = Boolean(user) || !token.id || !token.role;
      if (shouldHydrateToken && tokenEmail) {
        const dbUser = await getDbUserByEmail(tokenEmail);
        if (dbUser) {
          token.id = dbUser.id;
          token.role = normalizeRole(dbUser.role);
          token.picture = dbUser.avatar || (token.picture as string | null | undefined) || null;
          token.name = dbUser.name || (token.name as string | undefined);
          token.premium = hasActivePremiumEntitlement(
            dbUser.premium_access,
            dbUser.premium_expires_at
          );
          token.premiumExpiresAt = dbUser.premium_expires_at;
          token.email = dbUser.email;
        }
      }

      if (trigger === "update" && session) {
        if (typeof session.name === "string") {
          token.name = session.name;
        }
        if (typeof session.image === "string" || session.image === null) {
          token.picture = session.image;
        }

        const sessionUser = (session as { user?: { premium?: unknown; premiumExpiresAt?: unknown } }).user;
        if (typeof sessionUser?.premium === "boolean") {
          token.premium = sessionUser.premium;
        }
        if (
          typeof sessionUser?.premiumExpiresAt === "string" ||
          sessionUser?.premiumExpiresAt === null
        ) {
          token.premiumExpiresAt = sessionUser.premiumExpiresAt;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: AppRole }).role = normalizeRole(
          token.role as string | undefined
        );
        (session.user as { premium?: boolean }).premium = token.premium === true;
        (session.user as { premiumExpiresAt?: string | null }).premiumExpiresAt =
          (token.premiumExpiresAt as string | null | undefined) || null;
        session.user.name = (token.name as string | undefined) || session.user.name;
        session.user.image = (token.picture as string | null | undefined) || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
