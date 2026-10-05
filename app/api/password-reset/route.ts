import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordReset } from "@/lib/password-reset.server";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });
const THROTTLE_MS = 60 * 1000;

// Public "forgot password" endpoint. It always answers the same way, so it
// can't be used to discover who has an account, and it sends at most one
// email per person per minute so it can't be used to spam anyone.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("id, email, password_reset_sent_at")
    // Case-insensitive exact match: escape ilike's % and _ wildcards.
    .ilike("email", parsed.data.email.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();

  const recentlySent =
    profile?.password_reset_sent_at &&
    Date.now() - new Date(profile.password_reset_sent_at).getTime() < THROTTLE_MS;

  if (profile && !recentlySent) {
    await sendPasswordReset(request, profile);
  }

  return NextResponse.json({ ok: true });
}
