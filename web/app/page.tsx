import { createServerSupabaseClient } from "@/lib/supabase";
import { getEventCount } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const client = createServerSupabaseClient();
  const count = await getEventCount(client);

  return (
    <main>
      <h1>event_collector</h1>
      <p>収集済みイベント: {count} 件</p>
    </main>
  );
}
