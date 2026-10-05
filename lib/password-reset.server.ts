import { createAdminClient } from "./supabase/admin";
import { sendPasswordResetEmail, type EmailResult } from "./email";
import { siteUrl } from "./site-url";

/**
 * Creates a one-time password-reset link and emails it through the app's own
 * mailer (Supabase's built-in mailer only reaches members of the Supabase team).
 *
 * The link opens /reset-password, a page with a Continue button. The token is
 * only verified when that button POSTs it — email security scanners (e.g.
 * Outlook Safe Links) prefetch GET links and would otherwise burn the
 * one-time token before the person ever clicks.
 */
export async function sendPasswordReset(
  request: Request,
  person: { id: string; email: string },
  sentByName?: string
): Promise<{ resetUrl: string; email: EmailResult } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: person.email });
  if (error || !data?.properties?.hashed_token) {
    console.error("[password-reset] generateLink failed:", error);
    return null;
  }

  const params = new URLSearchParams({ token_hash: data.properties.hashed_token });
  const resetUrl = `${siteUrl(request)}/reset-password?${params}`;

  const email = await sendPasswordResetEmail({ to: person.email, resetUrl, sentByName });
  await admin
    .from("profiles")
    .update({ password_reset_sent_at: new Date().toISOString() })
    .eq("id", person.id);

  return { resetUrl, email };
}
