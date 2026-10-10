"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearSnapshot } from "@/lib/offline-store";
import { Button } from "@/components/ui";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    // Don't leave your events readable offline on this device.
    clearSnapshot();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="danger" full onClick={handleLogout}>
      Log out
    </Button>
  );
}
