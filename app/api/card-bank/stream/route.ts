import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCardBankOwnerVersion, subscribeCardBankOwner } from "@/lib/card-bank-realtime";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
};

function encodeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionUser = ((session || {}) as { user?: SessionUser }).user || {};
  const userId = String(sessionUser.id || "").trim();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(encodeEvent(event, payload)));
      };

      send("ready", {
        version: getCardBankOwnerVersion(userId),
      });

      unsubscribe = subscribeCardBankOwner(userId, (event) => {
        send("card-bank-update", event);
      });

      heartbeat = setInterval(() => {
        send("heartbeat", {
          at: Date.now(),
          version: getCardBankOwnerVersion(userId),
        });
      }, 15000);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "text/event-stream; charset=utf-8",
      "Connection": "keep-alive",
    },
  });
}
