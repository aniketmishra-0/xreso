import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");
type AppRole = "user" | "admin" | "moderator";

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const normalizedEmail = String(credentials.email).trim().toLowerCase();
        const providedPassword = String(credentials.password);
        if (!normalizedEmail || !providedPassword) return null;

        try {
          const sqlite = new Database(DB_PATH);
          const user = sqlite
            .prepare(
              "SELECT id, name, email, password, role, avatar, premium_access, premium_expires_at FROM users WHERE lower(email) = lower(?) LIMIT 1"
            )
            .get(normalizedEmail) as {
            id: string;
            name: string;
            email: string;
            password: string | null;
            role: string;
            avatar: string | null;
            premium_access: number;
            premium_expires_at: string | null;
          } | undefined;
          sqlite.close();

          if (!user || !user.password) return null;
          const isValid = compareSync(providedPassword, user.password);
          if (!isValid) return null;

          const premium = hasActivePremiumEntitlement(
            user.premium_access,
            user.premium_expires_at
          );

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: normalizeRole(user.role),
            image: user.avatar,
            premium,
            premiumExpiresAt: user.premium_expires_at,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
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
