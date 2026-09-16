import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** Minutes of inactivity before automatic logout (0 = never) */
    idleMinutes?: number;
  }
  interface User {
    idleMinutes?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    /** Seconds since epoch when the user signed in */
    loginAt?: number;
    /** Seconds since epoch of the last request */
    lastActivity?: number;
    idleMinutes?: number;
  }
}
