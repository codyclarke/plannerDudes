import { createAdminClient } from "./supabase/admin";
import { sendInviteEmail, type EmailResult } from "./email";
import { siteUrl } from "./site-url";

export const INVITE_TTL_DAYS = 14;

/**
 * (Re)sends an invite email and restarts its 14-day clock. The token is kept,
 * so any link already shared keeps working. Uses the admin client because
 * there's no client update policy on invites.
 */
export async function deliverInvite(
  request: Request,
  invite: { id: string; email: string; token: string },
  inviterName: string
): Promise<{ inviteUrl: string; email: EmailResult }> {
  const now = new Date();
  await createAdminClient()
    .from("invites")
    .update({
      last_sent_at: now.toISOString(),
      expires_at: new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", invite.id);

  const inviteUrl = `${siteUrl(request)}/signup/${invite.token}`;
  const email = await sendInviteEmail({ to: invite.email, inviterName, inviteUrl });
  return { inviteUrl, email };
}
