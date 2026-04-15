import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: "user" | "admin" | "moderator";
      premium?: boolean;
      premiumExpiresAt?: string | null;
    };
  }

  interface User {
    role?: "user" | "admin" | "moderator";
    premium?: boolean;
    premiumExpiresAt?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "user" | "admin" | "moderator";
    premium?: boolean;
    premiumExpiresAt?: string | null;
    picture?: string | null;
    name?: string;
  }
}
