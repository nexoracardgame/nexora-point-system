import CommunityClient from "@/app/(main)/community/CommunityClient";
import { getServerSession } from "next-auth";
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
  const lineId = String(session?.user?.lineId || "").trim();

  const [initialFriends, initialRequests] = userId
    ? await Promise.all([
        listFriendsForUser(userId).catch(() => []),
        listIncomingFriendRequests(userId, lineId ? [lineId] : []).catch(
          () => []
        ),
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
