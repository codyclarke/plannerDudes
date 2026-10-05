import { createClient } from "@/lib/supabase/server";
import { loadPeople } from "@/lib/people.server";
import NewEventForm from "./new-event-form";

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const people = await loadPeople(supabase);

  const others = people.list
    .filter((p) => p.id !== auth.user?.id)
    .map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl }));

  return <NewEventForm profiles={others} />;
}
