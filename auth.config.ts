import type { NextAuthConfig } from "next-auth";

/** Edge-safe Auth.js config (no database or bcrypt) used by middleware. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const signedIn = !!auth?.user;
      const onAuthPage = nextUrl.pathname === "/login" || nextUrl.pathname === "/signup";
      if (onAuthPage) return signedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      return signedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
