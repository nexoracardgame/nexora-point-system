import { getServerSession } from "next-auth";

import CommunityClient from "@/app/(main)/community/CommunityClient";
import { authOptions } from "@/lib/auth";
import {
  listFriendsForUser,
  listIncomingFriendRequests,
  searchCommunityUsers,
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
  let initialFriends: Awaited<ReturnType<typeof listFriendsForUser>> = [];
  let initialRequests: Awaited<
    ReturnType<typeof listIncomingFriendRequests>
  > = [];
  let initialSearch: Awaited<ReturnType<typeof searchCommunityUsers>> = {
    users: [],
    resultCount: 0,
    totalUsers: 0,
  };

  if (userId) {
    [initialFriends, initialRequests, initialSearch] = await Promise.all([
      listFriendsForUser(userId, aliases),
      listIncomingFriendRequests(userId, aliases),
      searchCommunityUsers(userId, "", aliases),
    ]);
  }

  return (
    <CommunityClient
      initialFriends={initialFriends}
      initialRequests={initialRequests}
      initialResults={initialSearch.users}
      initialResultCount={initialSearch.resultCount}
      initialTotalUsers={initialSearch.totalUsers}
      hasInitialCommunityState={Boolean(userId)}
    />
  );
}
