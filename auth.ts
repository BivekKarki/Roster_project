import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { DEFAULT_IDLE_MINUTES } from "@/lib/session-rules";
import { loginSchema } from "@/lib/validation";
import { consumeLoginTicket, verificationRequired } from "@/lib/verification";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    // Email + password
    Credentials({
      id: "credentials",
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, passwordHash: true, emailVerifiedAt: true, settings: { select: { idleTimeoutMinutes: true } } },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (verificationRequired() && !user.emailVerifiedAt) return null; // must confirm email first
        return { id: user.id, email: user.email, name: user.name, idleMinutes: user.settings?.idleTimeoutMinutes ?? DEFAULT_IDLE_MINUTES };
      },
    }),
    // One-time ticket issued right after the user verifies their email
    Credentials({
      id: "ticket",
      credentials: { ticket: {} },
      async authorize(raw) {
        const user = await consumeLoginTicket(typeof raw?.ticket === "string" ? raw.ticket : "");
        if (!user || !user.emailVerifiedAt) return null;
        return { id: user.id, email: user.email, name: user.name, idleMinutes: user.settings?.idleTimeoutMinutes ?? DEFAULT_IDLE_MINUTES };
      },
    }),
  ],
});
