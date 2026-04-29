import { getServerSession } from "next-auth";

import DMListClient from "@/app/(main)/dm/DMListClient";
import { authOptions } from "@/lib/auth";
import { getDmRoomsForUser } from "@/lib/dm-list";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function DMPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const userId = String(user?.id || "").trim();
  const lineId = String(
    ((user || {}) as { lineId?: string | null }).lineId || ""
  ).trim();
  const initialRooms = userId ? await getDmRoomsForUser(userId, lineId) : [];
  const initialMe = userId
    ? {
        id: userId,
        lineId: lineId || null,
        name: user?.name || null,
        image: user?.image || null,
      }
    : null;

  return <DMListClient initialRooms={initialRooms} initialMe={initialMe} />;
}
