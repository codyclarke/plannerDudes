import { createClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/dashboard.server";
import DashboardView from "./dashboard-view";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { myName, cards } = await loadDashboard(supabase, auth.user.id);
  return <DashboardView name={myName} events={cards} />;
}
