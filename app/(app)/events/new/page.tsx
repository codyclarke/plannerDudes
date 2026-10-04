import { createClient } from "@/lib/supabase/server";
import NewEventForm from "./new-event-form";

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  const others = (profiles ?? []).filter((p) => p.id !== auth.user?.id);

  return <NewEventForm profiles={others} />;
}
