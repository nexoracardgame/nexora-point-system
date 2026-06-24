export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envStatus(name: string) {
  return `${name} ${process.env[name] ? "exists" : "missing"}`;
}

export async function GET(request: Request) {
  console.log("Messenger Webhook Status GET", {
    url: request.url,
    method: request.method,
    hasFacebookVerifyToken: Boolean(process.env.FACEBOOK_VERIFY_TOKEN),
    hasFacebookPageAccessToken: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
  });

  return new Response(
    [
      envStatus("FACEBOOK_VERIFY_TOKEN"),
      envStatus("FACEBOOK_PAGE_ACCESS_TOKEN"),
    ].join("\n"),
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      },
    }
  );
}
