"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import AdminUserAvatar from "@/app/admin/AdminUserAvatar";
import { nexoraAlert } from "@/lib/nexora-dialog";
import { formatThaiDateTime } from "@/lib/thai-time";

type UserRow = {
  id: string;
  name: string | null;
  image: string | null;
  displayName: string | null;
  username: string | null;
  lineId: string;
  nexPoint: number;
  coin: number;
  createdAt: string;
};

type EvidenceImage = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/^@+/, "");
}

function parseAdminAdjustment(value: string | undefined, label: string, integerOnly = false) {
  const raw = String(value || "").trim().replace(/[−–—]/g, "-").replace(/,/g, "");

  if (!raw) {
    return null;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount === 0 || (integerOnly && !Number.isInteger(amount))) {
    throw new Error(`${label} ต้องเป็นตัวเลข${integerOnly ? "จำนวนเต็ม" : ""} เช่น 100 หรือ -100`);
  }

  return amount;
}

function formatSignedAdjustment(asset: "NEX" | "COIN", amount: number) {
  const action = amount < 0 ? "ลด" : "เพิ่ม";
  return `${action} ${asset} ${Math.abs(amount).toLocaleString("th-TH")} สำเร็จ`;
}

function getAdjustmentDialogMeta(nexAmount: number | null, coinAmount: number | null) {
  const amounts = [nexAmount, coinAmount].filter(
    (amount): amount is number => amount !== null
  );
  const hasDecrease = amounts.some((amount) => amount < 0);
  const hasIncrease = amounts.some((amount) => amount > 0);

  return {
    title:
      hasDecrease && !hasIncrease
        ? "ลดแต้มสำเร็จ"
        : hasDecrease && hasIncrease
          ? "อัปเดตแต้มสำเร็จ"
          : "สำเร็จ",
    tone: hasDecrease ? ("warning" as const) : ("success" as const),
  };
}

export default function MembersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [nexInputs, setNexInputs] = useState<Record<string, string>>({});
  const [coinInputs, setCoinInputs] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [evidenceInputs, setEvidenceInputs] = useState<Record<string, EvidenceImage[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, 20_000);

    return () => window.clearInterval(interval);
  }, [router]);

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

  const readEvidenceFiles = async (lineId: string, files: FileList | null) => {
    if (!files?.length) return;

    const images = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .map(
          (file) =>
            new Promise<EvidenceImage>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  dataUrl: String(reader.result || ""),
                });
              reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
              reader.readAsDataURL(file);
            })
        )
    );

    setEvidenceInputs((prev) => ({
      ...prev,
      [lineId]: [...(prev[lineId] || []), ...images],
    }));
  };

  const removeEvidenceImage = (lineId: string, index: number) => {
    setEvidenceInputs((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

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

    if (nexAmount === null && coinAmount === null) {
      alert("กรอก NEX หรือ COIN");
      return;
    }

    try {
      setLoadingId(lineId);
      const response = await fetch("/api/admin/members/adjust-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId,
          nexAmount,
          coinAmount,
          note: noteInputs[lineId] || "",
          evidenceImages: evidenceInputs[lineId] || [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data.error || "อัปเดตแต้มไม่สำเร็จ");
      }

      const message = [
        nexAmount !== null ? formatSignedAdjustment("NEX", nexAmount) : "",
        coinAmount !== null ? formatSignedAdjustment("COIN", coinAmount) : "",
      ]
        .filter(Boolean)
        .join("\n");
      const dialogMeta = getAdjustmentDialogMeta(nexAmount, coinAmount);

      setNexInputs((prev) => ({ ...prev, [lineId]: "" }));
      setCoinInputs((prev) => ({ ...prev, [lineId]: "" }));
      setNoteInputs((prev) => ({ ...prev, [lineId]: "" }));
      setEvidenceInputs((prev) => ({ ...prev, [lineId]: [] }));
      router.refresh();
      await nexoraAlert({
        title: dialogMeta.title,
        message,
        tone: dialogMeta.tone,
      });
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
        const evidenceImages = evidenceInputs[user.lineId] || [];

        return (
          <div key={user.id} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AdminUserAvatar src={user.image} name={displayName} size="md" />
                <div className="min-w-0">
                  <Link
                    href={`/admin/members/${user.id}`}
                    prefetch
                    onMouseEnter={() => router.prefetch(`/admin/members/${user.id}`)}
                    onFocus={() => router.prefetch(`/admin/members/${user.id}`)}
                    onTouchStart={() => router.prefetch(`/admin/members/${user.id}`)}
                    className="text-lg font-black text-white hover:text-amber-300"
                  >
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

            <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(180px,1fr)_auto_auto]">
              <input
                value={nexInputs[user.lineId] || ""}
                onChange={(e) => setNexInputs((prev) => ({ ...prev, [user.lineId]: e.target.value }))}
                placeholder="เพิ่ม / ลด NEX"
                type="text"
                inputMode="decimal"
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
              />
              <input
                value={coinInputs[user.lineId] || ""}
                onChange={(e) => setCoinInputs((prev) => ({ ...prev, [user.lineId]: e.target.value }))}
                placeholder="เพิ่ม / ลด COIN"
                type="text"
                inputMode="decimal"
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
              />
              <input
                value={noteInputs[user.lineId] || ""}
                onChange={(e) => setNoteInputs((prev) => ({ ...prev, [user.lineId]: e.target.value }))}
                placeholder="หมายเหตุ"
                type="text"
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none"
              />
              <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-sky-300/18 bg-sky-300/10 px-4 py-3 text-sm font-black text-sky-200 transition hover:bg-sky-300/16">
                <ImagePlus className="h-4 w-4" />
                แนบรูป
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void readEvidenceFiles(user.lineId, event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => updateMember(user.lineId)}
                disabled={loadingId === user.lineId}
                className="rounded-2xl bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black text-black disabled:opacity-70"
              >
                {loadingId === user.lineId ? "..." : "ยืนยัน"}
              </button>
            </div>

            {evidenceImages.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {evidenceImages.map((image, index) => (
                  <div
                    key={`${image.name}-${index}`}
                    className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-black/35"
                  >
                    <img src={image.dataUrl} alt={image.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEvidenceImage(user.lineId, index)}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-white"
                      aria-label="ลบรูปแนบ"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
