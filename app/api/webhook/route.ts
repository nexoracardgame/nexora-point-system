import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSENGER_GRAPH_API_URL =
  "https://graph.facebook.com/v23.0/me/messages";
const OPENAI_MODEL = "gpt-4.1-mini";

type MessengerEvent = {
  sender?: {
    id?: string;
  };
  message?: {
    text?: string;
  };
};

type MessengerWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: MessengerEvent[];
  }>;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function getOpenAIReply(message: string) {
  const client = new OpenAI({
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
  });

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are the Messenger AI assistant for Nexora เนคโซร่า การ์ดเกม. Reply clearly, helpfully, and in the same language as the user when possible.",
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  return (
    response.output_text?.trim() ||
    "ขออภัย ตอนนี้ระบบ AI ยังไม่สามารถตอบกลับได้ กรุณาลองใหม่อีกครั้ง"
  );
}

export async function sendMessengerMessage(recipientId: string, text: string) {
  const pageAccessToken = getRequiredEnv("FACEBOOK_PAGE_ACCESS_TOKEN");
  const response = await fetch(
    `${MESSENGER_GRAPH_API_URL}?access_token=${encodeURIComponent(
      pageAccessToken
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          id: recipientId,
        },
        message: {
          text,
        },
      }),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Facebook Messenger send failed: ${response.status} ${responseText}`
    );
  }

  console.log("Messenger Send Response", responseText);
}

async function handleMessengerEvent(event: MessengerEvent) {
  console.log("Messenger Event", event);

  const senderId = event.sender?.id;
  const messageText = event.message?.text?.trim();

  if (!senderId || !messageText) {
    console.log("Messenger Event skipped", {
      hasSenderId: Boolean(senderId),
      hasMessageText: Boolean(messageText),
    });
    return;
  }

  const reply = await getOpenAIReply(messageText);
  await sendMessengerMessage(senderId, reply);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge") || "";

  console.log("Messenger Webhook Verify", {
    mode,
    hasVerifyToken: Boolean(verifyToken),
    hasChallenge: Boolean(challenge),
  });

  if (verifyToken === process.env.FACEBOOK_VERIFY_TOKEN) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MessengerWebhookPayload;
    console.log("Messenger Webhook Payload", body);

    if (body.object !== "page") {
      console.log("Messenger Webhook skipped non-page object", body.object);
      return Response.json({ ok: true });
    }

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        try {
          await handleMessengerEvent(event);
        } catch (eventError) {
          console.error("Messenger Event Error", eventError);
        }
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Messenger Webhook Error", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
