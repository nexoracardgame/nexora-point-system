import { getDmRoomAccess } from "@/lib/dm-access";
import { getChatMessagesPage } from "@/lib/chat-room-server";
import {
  buildChatUser,
  CHAT_HISTORY_PAGE_SIZE,
  type ChatMessage,
  type ChatUser,
} from "@/lib/chat-room-types";
import {
  getDmConversationClearedAtForUserAliases,
  getDmRoomClearedAtForUser,
  getLatestClearTimestamp,
} from "@/lib/dm-room-clear-state";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { resolveUserIdentity, type SessionIdentityUser } from "@/lib/user-identity";

export type DirectChatBootstrap =
  | {
      ok: true;
      roomId: string;
      me: ChatUser;
      other: ChatUser;
      messages: ChatMessage[];
      hasMore: boolean;
      nextCursor: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function getDirectChatBootstrap(input: {
  roomId: string;
  sessionUser?: SessionIdentityUser | null;
  lineId?: string | null;
  limit?: number;
  before?: string | null;
}): Promise<DirectChatBootstrap> {
  const roomId = String(input.roomId || "").trim();
  const userId = String(input.sessionUser?.id || "").trim();
  const lineId = String(input.lineId || "").trim();

  if (!roomId || !userId) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
    };
  }

  const access = await getDmRoomAccess({
    roomId,
    userId,
    lineId,
  });

  if (!access.ok || access.kind !== "direct") {
    return {
      ok: false,
      status:
        !access.ok && access.reason === "not-found"
          ? 404
          : !access.ok && access.reason === "closed"
            ? 409
            : 403,
      error: access.ok ? "forbidden" : access.reason,
    };
  }

  const meIdentity = await resolveUserIdentity(input.sessionUser);
  const [roomClearedAt, conversationClearedAt] = await Promise.all([
    getDmRoomClearedAtForUser(userId, access.roomId),
    getDmConversationClearedAtForUserAliases(userId, [access.otherUserId]),
  ]);
  const clearedAt = getLatestClearTimestamp(roomClearedAt, conversationClearedAt);
  const otherProfile = access.otherUserId
    ? await getLocalProfileByUserId(access.otherUserId)
    : null;
  const roomUserAIsMe =
    access.room.usera === userId || (lineId ? access.room.usera === lineId : false);

  const other = buildChatUser(
    access.otherUserId,
    otherProfile?.displayName ||
      (roomUserAIsMe ? access.room.userbname : access.room.useraname) ||
      "User",
    otherProfile?.image ||
      (roomUserAIsMe ? access.room.userbimage : access.room.useraimage) ||
      "/avatar.png"
  );

  const page = await getChatMessagesPage({
    roomId: access.roomId,
    limit: input.limit || CHAT_HISTORY_PAGE_SIZE,
    before: input.before,
    after: clearedAt,
  });

  return {
    ok: true,
    roomId: access.roomId,
    me: buildChatUser(meIdentity.userId, meIdentity.name, meIdentity.image, "You"),
    other,
    messages: page.messages,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}
