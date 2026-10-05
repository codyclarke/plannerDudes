import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Spends a password-reset token (posted from /reset-password) and signs the
// person in, then sends them to choose a new password. The session cookies
// set by verifyOtp are carried on the redirect response.
export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = form.get("token_hash");

  if (typeof tokenHash === "string" && tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) {
      // 303 so the browser follows with a GET.
      return NextResponse.redirect(new URL("/update-password", request.url), 303);
    }
    console.error("[verify-reset] verifyOtp failed:", error.message);
  }
  return NextResponse.redirect(new URL("/forgot-password?expired=1", request.url), 303);
}
