import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmRoomAccess } from "@/lib/dm-access";
import type { DmAccessResult } from "@/lib/dm-access";
import { prisma } from "@/lib/prisma";
import { sendPushNotificationToUser } from "@/lib/push-notification-store";
import { resolveUserIdentity } from "@/lib/user-identity";
import { getServerSupabaseClient } from "@/lib/supabase-server";

type SendPayload = {
  roomId: string;
  content: string;
  imageUrl: string;
  file: File | null;
};

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

  await sendPushNotificationToUser(access.otherUserId, {
    id: `${access.kind === "deal" ? "deal-chat" : "chat"}-${data.id}`,
    title: identity.name,
    body: buildMessagePreview(content, imageUrl),
    href: await getChatPushHref(access),
    icon: identity.image,
    tag: `${access.kind === "deal" ? "deal-chat" : "chat"}-${data.id}`,
    type: "chat",
  }).catch((pushError) => {
    console.error("SEND DM PUSH NOTIFICATION ERROR:", pushError);
  });

  void supabase
    .from("dm_room")
    .update({ updatedat: new Date().toISOString() })
    .eq("roomid", access.roomId)
    .then(({ error: touchRoomError }) => {
      if (touchRoomError) {
        console.error("TOUCH DM ROOM AFTER SEND ERROR:", touchRoomError);
      }
    });

  return NextResponse.json({
    ...data,
    imageUrl: data?.imageUrl || imageUrl || null,
  });
}
