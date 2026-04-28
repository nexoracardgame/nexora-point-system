import { getServerSession } from "next-auth";
import DMListClient from "@/app/(main)/dm/DMListClient";
import { authOptions } from "@/lib/auth";

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

  return (
    <DMListClient
      initialRooms={[]}
      initialMe={{
        id: userId,
        lineId: lineId || null,
        name:
          String(session?.user?.name || "").trim() ||
          "NEXORA User",
        image:
          String(session?.user?.image || "").trim() ||
          "/avatar.png",
      }}
    />
  );
}
