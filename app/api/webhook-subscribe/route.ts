export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_API_BASE_URL = "https://graph.facebook.com/v23.0";
const SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_deliveries",
  "message_reads",
].join(",");

type FacebookSubscribedApp = {
  subscribed_fields?: string[];
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function readFacebookJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Facebook Graph API ${response.status}: ${text}`);
  }

  return JSON.parse(text) as T;
}

function hasMessagesSubscription(data: FacebookSubscribedApp[]) {
  return data.some((item) => item.subscribed_fields?.includes("messages"));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  console.log("Messenger Webhook Subscribe GET", {
    url: request.url,
    method: request.method,
    tokenMatches: token === process.env.FACEBOOK_VERIFY_TOKEN,
  });

  if (token !== process.env.FACEBOOK_VERIFY_TOKEN) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const pageAccessToken = getRequiredEnv("FACEBOOK_PAGE_ACCESS_TOKEN");
    const accessToken = encodeURIComponent(pageAccessToken);
    const page = await readFacebookJson<{ id: string; name?: string }>(
      `${GRAPH_API_BASE_URL}/me?fields=id,name&access_token=${accessToken}`
    );
    const before = await readFacebookJson<{ data: FacebookSubscribedApp[] }>(
      `${GRAPH_API_BASE_URL}/me/subscribed_apps?access_token=${accessToken}`
    );
    const alreadySubscribed = hasMessagesSubscription(before.data || []);
    let subscribeResult: unknown = null;
    let after = before;

    if (!alreadySubscribed) {
      subscribeResult = await readFacebookJson<{ success?: boolean }>(
        `${GRAPH_API_BASE_URL}/me/subscribed_apps?subscribed_fields=${SUBSCRIBED_FIELDS}&access_token=${accessToken}`,
        { method: "POST" }
      );
      after = await readFacebookJson<{ data: FacebookSubscribedApp[] }>(
        `${GRAPH_API_BASE_URL}/me/subscribed_apps?access_token=${accessToken}`
      );
    }

    return Response.json(
      {
        ok: true,
        page,
        alreadySubscribed,
        subscribedFieldsRequested: SUBSCRIBED_FIELDS.split(","),
        subscribeResult,
        before: before.data || [],
        after: after.data || [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Messenger Webhook Subscribe Error", error);
    const message =
      error instanceof Error ? error.message : "Webhook subscribe failed";

    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
