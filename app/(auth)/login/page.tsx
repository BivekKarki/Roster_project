import type { Metadata } from "next";
import { LoginForm } from "@/components/AuthForms";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; verified?: string; error?: string; email?: string }> }) {
  const { reason, verified, error, email } = await searchParams;
  return (
    <>
      {reason === "idle" && (
        <div className="mb-3">
          <Alert tone="info">You were logged out because there was no activity for a while. Log in again to continue.</Alert>
        </div>
      )}
      {verified && (
        <div className="mb-3">
          <Alert tone="ok">Your email is confirmed. Log in to continue.</Alert>
        </div>
      )}
      <LoginForm error={error} email={email} />
    </>
  );
}
