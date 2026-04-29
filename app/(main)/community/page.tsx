import { getServerSession } from "next-auth";

import CommunityClient from "@/app/(main)/community/CommunityClient";
import { authOptions } from "@/lib/auth";
import {
  listFriendsForUser,
  listIncomingFriendRequests,
} from "@/lib/friend-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function CommunityPage() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const lineId = String(
    ((session?.user || {}) as { lineId?: string | null }).lineId || ""
  ).trim();
  const aliases = lineId && lineId !== userId ? [lineId] : [];
  const [initialFriends, initialRequests] = userId
    ? await Promise.all([
        listFriendsForUser(userId, aliases),
        listIncomingFriendRequests(userId, aliases),
      ])
    : [[], []];

  return (
    <CommunityClient
      initialFriends={initialFriends}
      initialRequests={initialRequests}
      hasInitialCommunityState={Boolean(userId)}
    />
  );
}
