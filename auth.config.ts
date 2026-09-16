import type { NextAuthConfig } from "next-auth";
import { DEFAULT_IDLE_MINUTES, isIdleOption, sessionEndReason, sessionMaxDays } from "@/lib/session-rules";

const MAX_AGE_SECONDS = sessionMaxDays() * 86_400;

/**
 * Edge-safe Auth.js config (no database or bcrypt) used by middleware.
 *
 * Sessions are signed JWT cookies. Every request re-runs the jwt callback, which:
 *  - ends the session after the user's idle timeout (Settings → Profile), and
 *  - ends it after SESSION_MAX_DAYS (default 30) no matter what.
 * Returning null from the jwt callback clears the cookie, so the user is sent to /login.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: MAX_AGE_SECONDS },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const signedIn = !!auth?.user;
      const onAuthPage = nextUrl.pathname === "/login" || nextUrl.pathname === "/signup" || nextUrl.pathname.startsWith("/verify-email");
      if (onAuthPage) return signedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      return signedIn;
    },
    jwt({ token, user, trigger, session }) {
      const now = Math.floor(Date.now() / 1000);

      // Just signed in
      if (user?.id) {
        token.sub = user.id;
        token.loginAt = now;
        token.lastActivity = now;
        token.idleMinutes = user.idleMinutes ?? DEFAULT_IDLE_MINUTES;
        return token;
      }

      // The user changed their auto-logout setting
      if (trigger === "update" && typeof session?.idleMinutes === "number" && isIdleOption(session.idleMinutes)) {
        token.idleMinutes = session.idleMinutes;
      }

      if (sessionEndReason(token, now) !== null) return null;

      token.loginAt ??= now;
      token.lastActivity = now;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      session.idleMinutes = token.idleMinutes ?? DEFAULT_IDLE_MINUTES;
      return session;
    },
  },
} satisfies NextAuthConfig;
