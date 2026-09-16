import "server-only";

export type Email = { to: string; subject: string; html: string; text: string };

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't set up. Add RESEND_API_KEY and EMAIL_FROM to the environment.");
  }
}

/**
 * Sends an email through Resend (https://resend.com).
 * Without RESEND_API_KEY in development (or with EMAIL_TRANSPORT="console"), the email is printed
 * in the terminal instead, so you can test sign-up locally.
 */
export async function sendEmail(email: Email) {
  const key = process.env.RESEND_API_KEY;
  const useConsole = process.env.EMAIL_TRANSPORT === "console" || (!key && process.env.NODE_ENV !== "production");

  if (useConsole) {
    console.log(`\n📧 EMAIL (not sent, console mode)\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
    return { id: "console" };
  }
  if (!key) throw new EmailNotConfiguredError();

  const response = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "ShiftBook <onboarding@resend.dev>",
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as { id: string };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function verificationEmail({ to, name, code, link, minutes }: { to: string; name: string | null; code: string; link: string; minutes: number }): Email {
  const hello = name ? `Hi ${name},` : "Hi,";
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const text = [
    hello,
    "",
    `Your ShiftBook verification code is: ${spaced}`,
    "",
    "Or confirm your email by opening this link:",
    link,
    "",
    `The code and link expire in ${minutes} minutes. If you didn't create a ShiftBook account, you can ignore this email.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en-AU"><body style="margin:0;background:#f1f5f9;font-family:system-ui,-apple-system,Roboto,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
        <tr><td style="background:#1e3a5f;color:#ffffff;padding:16px 24px;border-radius:16px 16px 0 0;font-size:18px;font-weight:700">ShiftBook</td></tr>
        <tr><td style="padding:24px">
          <p style="margin:0 0 12px;font-size:16px">${escapeHtml(hello)}</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.5">Enter this code to confirm your email:</p>
          <p style="margin:0 0 20px;text-align:center;font-size:34px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;background:#e8eef6;border-radius:12px;padding:14px 0">${spaced}</p>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.5">Or tap the button:</p>
          <p style="margin:0 0 20px;text-align:center">
            <a href="${escapeHtml(link)}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:12px">Confirm my email</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#475569">The code and link expire in ${minutes} minutes. If you didn't create a ShiftBook account for ${escapeHtml(to)}, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { to, subject: `${spaced} is your ShiftBook code`, html, text };
}
