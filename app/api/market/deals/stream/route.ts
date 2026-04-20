import { subscribeDealEvents, type DealRealtimeEvent } from "@/lib/deal-events";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function encodeSseMessage(event: DealRealtimeEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: DealRealtimeEvent) => {
        controller.enqueue(encoder.encode(encodeSseMessage(event)));
      };

      send({
        action: "refresh",
        changedAt: new Date().toISOString(),
        timestamp: Date.now(),
      });

      const unsubscribe = subscribeDealEvents(send);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 20000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.signal.addEventListener(
        "abort",
        () => {
          cleanup();
          controller.close();
        },
        { once: true }
      );
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
