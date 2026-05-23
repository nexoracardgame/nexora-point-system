import { getServerSupabaseClient } from "@/lib/supabase-server";
import {
  LIVE_REALTIME_CHANNEL,
  LIVE_REALTIME_EVENT,
  type LiveRealtimePayload,
} from "@/lib/live-realtime";

export async function publishLiveRealtime(payload: LiveRealtimePayload) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return;

  const channel = supabase.channel(LIVE_REALTIME_CHANNEL, {
    config: {
      broadcast: {
        ack: false,
        self: false,
      },
    },
  });

  try {
    await channel.send(
      {
        type: "broadcast",
        event: LIVE_REALTIME_EVENT,
        payload: {
          ...payload,
          at: Date.now(),
        } satisfies LiveRealtimePayload,
      },
      { timeout: 500 }
    );
  } catch {
    // Realtime only accelerates sync; clients still poll as a fallback.
  } finally {
    void supabase.removeChannel(channel);
  }
}
