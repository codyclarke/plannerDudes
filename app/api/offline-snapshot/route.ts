import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOfflineSnapshot } from "@/lib/offline-snapshot.server";

// Read-only copy of the caller's upcoming events for the installed app to
// keep on the device (see lib/offline-store.ts). Built with the caller's own
// RLS-scoped client, so it only ever contains what they can already see.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snapshot = await buildOfflineSnapshot(supabase, auth.user.id);
  // Personal data: never let a shared cache (CDN/proxy) keep it.
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
}
