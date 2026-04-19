import { getServerSession } from "next-auth";
import DMListClient from "@/app/(main)/dm/DMListClient";
import { authOptions } from "@/lib/auth";
import { getDmRoomsForUser } from "@/lib/dm-list";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function DMPage() {
  const session = await getServerSession(authOptions);
  const myId = String(session?.user?.id || "").trim();
  const myLineId = String(session?.user?.lineId || "").trim() || null;

  const initialRooms = myId ? await getDmRoomsForUser(myId, myLineId) : [];
  const initialMe = myId
    ? {
        id: myId,
        lineId: myLineId,
        name: session?.user?.name || null,
        image: session?.user?.image || null,
      }
    : null;

  return <DMListClient initialRooms={initialRooms} initialMe={initialMe} />;
}
