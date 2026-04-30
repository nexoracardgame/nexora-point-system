import { prisma } from "@/lib/prisma";
import { getAllLocalProfiles } from "@/lib/local-profile-store";
import MembersTable from "./MembersTable";

type AdminMemberRow = {
  id: string;
  name: string | null;
  displayName: string | null;
  username: string | null;
  lineId: string;
  nexPoint: number | null;
  coin: number | null;
  createdAt: Date;
};

export default async function MembersPage() {
  await prisma
    .$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT')
    .catch(() => undefined);

  const [users, localProfiles] = await Promise.all([
    prisma
      .$queryRawUnsafe<AdminMemberRow[]>(
        'SELECT "id", "name", "displayName", "username", "lineId", "nexPoint", "coin", "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 1000'
      )
      .catch(() => []),
    getAllLocalProfiles().catch(() => []),
  ]);
  const localProfileMap = new Map(
    localProfiles.map((profile) => [profile.userId, profile])
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">
          Admin Members
        </div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          สมาชิกทั้งหมด
        </h1>
      </div>

      <MembersTable
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          displayName:
            localProfileMap.get(user.id)?.displayName ||
            localProfileMap.get(user.lineId)?.displayName ||
            user.displayName,
          username:
            localProfileMap.get(user.id)?.username ||
            localProfileMap.get(user.lineId)?.username ||
            user.username,
          lineId: user.lineId,
          nexPoint: Number(user.nexPoint || 0),
          coin: Number(user.coin || 0),
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
