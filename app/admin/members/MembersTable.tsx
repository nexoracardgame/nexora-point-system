"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatThaiDateTime } from "@/lib/thai-time";

type UserRow = {
  id: string;
  name: string | null;
  displayName: string | null;
  username: string | null;
  lineId: string;
  nexPoint: number;
  coin: number;
  createdAt: string;
};

function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/^@+/, "");
}

function parseAdminAdjustment(value: string | undefined, label: string, integerOnly = false) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount === 0 || (integerOnly && !Number.isInteger(amount))) {
    throw new Error(`${label} ต้องเป็นตัวเลข${integerOnly ? "จำนวนเต็ม" : ""} เช่น 100 หรือ -100`);
  }

  return amount;
}

export default function MembersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [nexInputs, setNexInputs] = useState<Record<string, string>>({});
  const [coinInputs, setCoinInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const keyword = normalizeSearch(query);

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const username = normalizeSearch(user.username || "");
      const fields = [
        user.name,
        user.displayName,
        user.lineId,
        user.id,
        user.username,
        username ? `@${username}` : "",
      ]
        .map((value) => normalizeSearch(String(value || "")))
        .filter(Boolean);

      return fields.some((field) => field.includes(keyword));
    });
  }, [query, users]);

  const updateMember = async (lineId: string) => {
    let nexAmount: number | null = null;
    let coinAmount: number | null = null;

    try {
      nexAmount = parseAdminAdjustment(nexInputs[lineId], "NEX");
      coinAmount = parseAdminAdjustment(coinInputs[lineId], "COIN", true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "จำนวนไม่ถูกต้อง");
      return;
    }

    if (nexAmount === null && coinAmount === null) return alert("กรอก NEX หรือ COIN");

    try {
      setLoadingId(lineId);
      if (nexAmount !== null) {
        const nexRes = await fetch("/api/admin/members/update-nex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, amount: nexAmount }),
        });
        const nexData = await nexRes.json().catch(() => ({}));
        if (!nexRes.ok) throw new Error(nexData.error || "อัปเดต NEX ไม่สำเร็จ");
      }
      if (coinAmount !== null) {
        const coinRes = await fetch("/api/admin/members/update-coin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, amount: coinAmount }),
        });
        const coinData = await coinRes.json().catch(() => ({}));
        if (!coinRes.ok) throw new Error(coinData.error || "อัปเดต COIN ไม่สำเร็จ");
      }
      setNexInputs((prev) => ({ ...prev, [lineId]: "" }));
      setCoinInputs((prev) => ({ ...prev, [lineId]: "" }));
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "อัปเดตแต้มไม่สำเร็จ");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
              Search Members
            </div>
            <div className="mt-1 text-sm font-bold text-white/55">
              ค้นหาชื่อ, Line ID หรือ @username ได้ทันที
            </div>
          </div>
          <div className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-black text-white/70 ring-1 ring-white/10">
            {filteredUsers.length.toLocaleString("th-TH")} /{" "}
            {users.length.toLocaleString("th-TH")}
          </div>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาชื่อ, Line ID, @username"
          className="mt-3 h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base font-bold text-white outline-none transition placeholder:text-white/35 focus:border-amber-300/35 focus:ring-2 focus:ring-amber-300/10"
        />
      </div>

      {filteredUsers.map((user) => {
        const displayName = user.displayName || user.name || "-";
        const username = String(user.username || "").trim().replace(/^@+/, "");

        return (
        <div key={user.id} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/admin/members/${user.id}`} className="text-lg font-black text-white hover:text-amber-300">
                {displayName}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="break-all rounded-full bg-white/[0.05] px-3 py-1 text-sm font-bold text-white/50 ring-1 ring-white/10">
                  {user.lineId}
                </div>
                {username ? (
                  <div className="break-all rounded-full bg-amber-300/12 px-3 py-1 text-sm font-black text-amber-200 ring-1 ring-amber-300/20">
                    @{username}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-amber-200/65">NEX</div>
                <div className="mt-1 font-black text-amber-300">{user.nexPoint}</div>
              </div>
              <div className="rounded-2xl border border-sky-300/15 bg-sky-300/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-sky-200/65">COIN</div>
                <div className="mt-1 font-black text-sky-300">{user.coin}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-white/42">{formatThaiDateTime(user.createdAt)}</div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={nexInputs[user.lineId] || ""}
              onChange={(e) => setNexInputs((prev) => ({ ...prev, [user.lineId]: e.target.value }))}
              placeholder="เพิ่ม / ลด NEX"
              type="number"
              step="any"
              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
            />
            <input
              value={coinInputs[user.lineId] || ""}
              onChange={(e) => setCoinInputs((prev) => ({ ...prev, [user.lineId]: e.target.value }))}
              placeholder="เพิ่ม / ลด COIN"
              type="number"
              step="1"
              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
            />
            <button
              type="button"
              onClick={() => updateMember(user.lineId)}
              disabled={loadingId === user.lineId}
              className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black disabled:opacity-70"
            >
              {loadingId === user.lineId ? "..." : "ยืนยัน"}
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
