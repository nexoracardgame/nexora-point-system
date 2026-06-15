import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAllLocalProfiles } from "@/lib/local-profile-store";
import CreateCardBankEntryClient from "./CreateCardBankEntryClient";

export const dynamic = "force-dynamic";

type AdminMemberRow = {
  id: string;
  name: string | null;
  image: string | null;
  displayName: string | null;
  username: string | null;
  lineId: string;
  nexPoint: number | null;
  coin: number | null;
  createdAt: Date;
};

export default async function CreateCardBankEntryPage() {
  await prisma
    .$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT')
    .catch(() => undefined);

  const [users, localProfiles] = await Promise.all([
    prisma
      .$queryRawUnsafe<AdminMemberRow[]>(
        'SELECT "id", "name", "image", "displayName", "username", "lineId", "nexPoint", "coin", "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 1000'
      )
      .catch(() => []),
    getAllLocalProfiles().catch(() => []),
  ]);

  const localProfileMap = new Map(
    localProfiles.map((profile) => [profile.userId, profile])
  );

  const normalizedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    image:
      localProfileMap.get(user.id)?.image ||
      localProfileMap.get(user.lineId)?.image ||
      user.image,
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
  }));

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/card-bank"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            ย้อนกลับ
          </Link>
          <div className="mt-4 text-[11px] font-black uppercase tracking-[0.24em] text-white/35">
            Create Custody Entry
          </div>
          <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
            เพิ่มรายการฝากการ์ด
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
            เลือกลูกค้าก่อน แล้วเลือกว่าจะสร้างรายการธนาคารการ์ดหรือรับฝากการ์ด
            ระบบนี้ออกแบบให้พนักงานคีย์รายการได้เร็ว แต่ยังเห็นเงื่อนไขสำคัญก่อนบันทึกทุกครั้ง
          </p>
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.055] text-white">
          <Landmark className="h-6 w-6" />
        </div>
      </div>

      <CreateCardBankEntryClient users={normalizedUsers} />
    </div>
  );
}
