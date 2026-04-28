import { getServerSession } from "next-auth";
import DMListClient from "@/app/(main)/dm/DMListClient";
import { authOptions } from "@/lib/auth";
import { getDmRoomsForUser } from "@/lib/dm-list";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function DMPage() {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const lineId = String(
    (((session?.user as { lineId?: string } | undefined) || {}).lineId || "")
  ).trim();

  if (!userId) {
    return <DMListClient initialRooms={[]} initialMe={null} />;
  }

  const [rooms, profile] = await Promise.all([
    getDmRoomsForUser(userId, lineId),
    getLocalProfileByUserId(userId),
  ]);

  return (
    <DMListClient
      initialRooms={rooms}
      initialMe={{
        id: userId,
        lineId: lineId || null,
        name:
          String(profile?.displayName || session?.user?.name || "").trim() ||
          "NEXORA User",
        image:
          String(profile?.image || session?.user?.image || "").trim() ||
          "/avatar.png",
      }}
    />
  );
}
