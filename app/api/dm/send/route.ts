import { after, NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAuctionDealId } from "@/lib/auction-deal-chat";
import { getDmRoomAccess } from "@/lib/dm-access";
import type { DmAccessResult } from "@/lib/dm-access";
import { prisma } from "@/lib/prisma";
import { sendPushNotificationToUser } from "@/lib/push-notification-store";
import { resolveUserIdentity } from "@/lib/user-identity";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import {
  CHAT_MESSAGE_BROADCAST_EVENT,
  getChatRoomBroadcastTopic,
  getChatUserBroadcastTopic,
  type ChatRealtimeBroadcastPayload,
} from "@/lib/chat-realtime-broadcast";

type SendPayload = {
  roomId: string;
  content: string;
  imageUrl: string;
  file: File | null;
};

type SuccessfulDmAccess = Extract<DmAccessResult, { ok: true }>;

function getImageExtension(contentType: string) {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  return ".jpg";
}

function buildMessagePreview(content?: string | null, imageUrl?: string | null) {
  const text = String(content || "").trim();
  if (text) return text;
  if (imageUrl) return "ส่งรูปภาพ";
  return "ส่งข้อความ";
}

async function getChatPushHref(access: Extract<DmAccessResult, { ok: true }>) {
  if (access.kind === "direct") {
    return `/dm/${encodeURIComponent(access.roomId)}`;
  }

  try {
    if (isAuctionDealId(access.dealId)) {
      return `/market/deals/chat/${encodeURIComponent(access.dealId)}`;
    }

    const deal = await prisma.dealRequest.findUnique({
      where: {
        id: access.dealId,
      },
      select: {
        cardId: true,
      },
    });
    const listing = deal?.cardId
      ? await prisma.marketListing.findUnique({
          where: {
            id: deal.cardId,
          },
          select: {
            status: true,
          },
        })
      : null;
    const isBuyDeal =
      String(listing?.status || "").trim().toLowerCase() === "wanted";
    const basePath = isBuyDeal ? "/buy-market/deals/chat" : "/market/deals/chat";

    return `${basePath}/${encodeURIComponent(access.dealId)}`;
  } catch {
    return `/market/deals/chat/${encodeURIComponent(access.dealId)}`;
  }
}

function uniqueText(values: Array<string | number | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function getBroadcastRoomIds(access: SuccessfulDmAccess) {
  return uniqueText([
    access.roomId,
    access.kind === "deal" ? `deal:${access.dealId}` : null,
  ]);
}

async function broadcastChatMessage({
  supabase,
  payload,
  userIds,
}: {
  supabase: SupabaseClient;
  payload: ChatRealtimeBroadcastPayload;
  userIds: Array<string | null | undefined>;
}) {
  const topics = uniqueText([
    payload.roomId,
    ...(Array.isArray(payload.roomIds) ? payload.roomIds : []),
  ])
    .map((roomId) => getChatRoomBroadcastTopic(roomId))
    .concat(userIds.map((userId) => getChatUserBroadcastTopic(userId)))
    .filter(Boolean);
  const uniqueTopics = Array.from(new Set(topics));

  if (!uniqueTopics.length) {
    return;
  }

  const results = await Promise.allSettled(
    uniqueTopics.map((topic) =>
      supabase
        .channel(topic)
        .httpSend(CHAT_MESSAGE_BROADCAST_EVENT, payload, { timeout: 900 })
    )
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("SEND DM BROADCAST ERROR:", result.reason);
      continue;
    }

    if (!result.value.success) {
      console.error("SEND DM BROADCAST ERROR:", result.value);
    }
  }
}

async function readPayload(req: NextRequest): Promise<SendPayload> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");

    return {
      roomId: String(formData.get("roomId") || "").trim(),
      content: String(formData.get("content") || "").trim(),
      imageUrl: String(formData.get("imageUrl") || "").trim(),
      file: file instanceof File && file.size > 0 ? file : null,
    };
  }

  const body = await req.json();

  return {
    roomId: String(body?.roomId || "").trim(),
    content: String(body?.content || "").trim(),
    imageUrl: String(body?.imageUrl || "").trim(),
    file: null,
  };
}

async function uploadMessageImage({
  file,
  userId,
  supabase,
}: {
  file: File;
  userId: string;
  supabase: SupabaseClient;
}) {
  const contentType = String(file.type || "image/jpeg").trim();

  if (!contentType.startsWith("image/")) {
    throw new Error("invalid image");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const extension = getImageExtension(contentType);
  const fileName = `chat/${userId}-${Date.now()}-${crypto.randomUUID()}${extension}`;

  const uploadResult = await supabase.storage
    .from("chat-images")
    .upload(fileName, buffer, {
      upsert: false,
      contentType,
      cacheControl: "31536000",
    });

  if (!uploadResult.error) {
    const { data: publicUrl } = supabase.storage
      .from("chat-images")
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  }

  if (process.env.NODE_ENV === "production") {
    console.error("SEND DM IMAGE UPLOAD ERROR:", uploadResult.error);
    throw new Error("upload failed");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "chat");
  const localFileName = `${userId}-${Date.now()}-${crypto.randomUUID()}${extension}`;
  const filePath = path.join(uploadDir, localFileName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer);

  return `/uploads/chat/${localFileName}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const identity = await resolveUserIdentity(session?.user);
  const senderId = identity.userId;
  const lineId = String(
    (((session?.user as { lineId?: string } | undefined) || {}).lineId || "")
  ).trim();

  if (!senderId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await readPayload(req);
  const roomId = payload.roomId;
  const content = payload.content;

  if (!roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }

  if (!content && !payload.imageUrl && !payload.file) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "system unavailable" }, { status: 500 });
  }

  const access = await getDmRoomAccess({
    roomId,
    userId: senderId,
    lineId,
  });

  if (!access.ok) {
    const status =
      access.reason === "not-found"
        ? 404
        : access.reason === "closed"
          ? 409
          : 403;

    return NextResponse.json({ error: access.reason }, { status });
  }

  let imageUrl = payload.imageUrl;

  if (payload.file) {
    try {
      imageUrl = await uploadMessageImage({
        file: payload.file,
        userId: senderId,
        supabase,
      });
    } catch (error) {
      console.error("SEND DM IMAGE ERROR:", error);
      return NextResponse.json({ error: "upload failed" }, { status: 500 });
    }
  }

  if (!content && !imageUrl) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  const contentForDb = content || (imageUrl ? "" : null);

  const { data, error } = await supabase
    .from("dmMessage")
    .insert({
      roomId: access.roomId,
      senderId,
      content: contentForDb,
      imageUrl: imageUrl || null,
      senderName: identity.name,
      senderImage: identity.image,
    })
    .select("*")
    .single();

  if (error) {
    console.error("SEND DM API ERROR:", error);
    return NextResponse.json({ error: "send failed" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const insertedMessage = {
    ...data,
    imageUrl: data?.imageUrl || imageUrl || null,
  };
  const roomIds = getBroadcastRoomIds(access);
  const broadcastPayload: ChatRealtimeBroadcastPayload = {
    ...insertedMessage,
    id: insertedMessage.id,
    roomId: access.roomId,
    roomIds,
    senderId,
    senderName: identity.name,
    senderImage: identity.image,
    content: contentForDb,
    imageUrl: insertedMessage.imageUrl,
    createdAt: insertedMessage.createdAt || now,
    seenAt: insertedMessage.seenAt || null,
    source: "send-route-broadcast",
  };

  await broadcastChatMessage({
    supabase,
    payload: broadcastPayload,
    userIds: uniqueText([senderId, lineId, access.otherUserId]),
  });

  after(async () => {
    const notifyUser = async () => {
      try {
        await sendPushNotificationToUser(access.otherUserId, {
          id: `${access.kind === "deal" ? "deal-chat" : "chat"}-${data.id}`,
          title: identity.name,
          body: buildMessagePreview(content, imageUrl),
          href: await getChatPushHref(access),
          icon: identity.image,
          image: identity.image,
          tag: `${access.kind === "deal" ? "deal-chat" : "chat"}-${data.id}`,
          type: "chat",
        });
      } catch (pushError) {
        console.error("SEND DM PUSH NOTIFICATION ERROR:", pushError);
      }
    };

    const touchRoom = async () => {
      const { error: touchRoomError } = await supabase
        .from("dm_room")
        .update({ updatedat: now })
        .eq("roomid", access.roomId);

      if (touchRoomError) {
        console.error("TOUCH DM ROOM AFTER SEND ERROR:", touchRoomError);
      }
    };

    await Promise.allSettled([notifyUser(), touchRoom()]);
  });

  return NextResponse.json(insertedMessage);
}
