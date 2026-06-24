export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  console.log("Messenger Webhook Test GET", {
    url: request.url,
    method: request.method,
  });

  return new Response("WEBHOOK_OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
    },
  });
}
