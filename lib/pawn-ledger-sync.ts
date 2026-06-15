import "server-only";

import type { CardBankAsset } from "@/lib/card-bank-store";

const DEFAULT_PAWN_LEDGER_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbw8RJSG7jX4wKKSApM3q7M630zLQzLla-MEUZKyMN_uYc2BvFeNPchxUt9hBg3fgzaU/exec";

type PawnLedgerSyncEntry = {
  recordId: string;
  assetId: string;
  ownerId: string;
  ownerLineId: string;
  ownerName: string;
  pledgeDate: string;
  createdAt: string;
  cardLabel: string;
  quantity: number;
  principalTHB: number;
  monthlyInterestRate: number;
  monthlyInterestTHB: number;
  dueDate: string;
  status: string;
  note: string;
  staffName: string;
  updatedAt: string;
};

type SyncResult = {
  ok: boolean;
  skipped?: boolean;
  updated?: number;
  inserted?: number;
  error?: string;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  date.setDate(date.getDate() + days);
  return date;
}

function parseNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getSyncStatusLabel(status: string) {
  if (status === "forfeited") return "ปิดสิทธิ์รับฝาก";
  if (status === "withdrawn" || status === "converted") return "ปิดบัญชี";
  return "กำลังใช้งาน";
}

function getPawnSource(asset: CardBankAsset) {
  const source = asset.sourcePayload && typeof asset.sourcePayload === "object"
    ? asset.sourcePayload
    : null;
  const pawn = source && typeof source.pawn === "object" ? (source.pawn as Record<string, unknown>) : null;
  return pawn;
}

function buildEntry(asset: CardBankAsset): PawnLedgerSyncEntry | null {
  if (asset.entryMode !== "pawn") {
    return null;
  }

  const pawn = getPawnSource(asset);
  const principalTHB = Math.max(
    0,
    parseNumber(pawn?.principalTHB ?? asset.valueTHB ?? 0)
  );
  const monthlyInterestRate = Math.max(0, parseNumber(pawn?.interestRate ?? 10));
  const monthlyInterestTHB = Math.max(
    0,
    parseNumber(pawn?.monthlyInterestTHB ?? Math.round(principalTHB * (monthlyInterestRate / 100)))
  );
  const dueDays = Math.max(1, Math.floor(parseNumber(pawn?.dueDays ?? 30)) || 30);
  const dueDate = cleanText(pawn?.dueDate || "");

  return {
    recordId: cleanText(asset.id),
    assetId: cleanText(asset.id),
    ownerId: cleanText(asset.ownerId),
    ownerLineId: cleanText(asset.ownerLineId || ""),
    ownerName: cleanText(asset.ownerName) || "NEXORA Customer",
    pledgeDate: cleanText(asset.createdAt),
    createdAt: cleanText(asset.createdAt),
    cardLabel:
      asset.intakeMode === "sets"
        ? cleanText(asset.setName || asset.cardName)
        : asset.cardNo
          ? `No.${cleanText(asset.cardNo)} ${cleanText(asset.cardName)}`
          : cleanText(asset.cardName),
    quantity: Math.max(1, Math.floor(parseNumber(asset.quantity || 1))),
    principalTHB,
    monthlyInterestRate,
    monthlyInterestTHB,
    dueDate: dueDate || addDays(asset.createdAt, dueDays).toISOString(),
    status: getSyncStatusLabel(asset.status),
    note:
      cleanText(pawn?.note || "") ||
      (asset.status === "forfeited" ? "ปิดสิทธิ์รับฝาก" : asset.status === "withdrawn" ? "ปิดบัญชี" : ""),
    staffName: cleanText(asset.createdByName) || "NEXORA Staff",
    updatedAt: cleanText(asset.updatedAt) || new Date().toISOString(),
  };
}

export async function syncPawnLedgerEntries(assets: CardBankAsset[]): Promise<SyncResult> {
  const endpoint =
    String(process.env.PAWN_LEDGER_WEBHOOK_URL || "").trim() ||
    DEFAULT_PAWN_LEDGER_WEBHOOK_URL;
  const token = String(process.env.PAWN_LEDGER_SYNC_TOKEN || "").trim();

  const entries = assets.map(buildEntry).filter((entry): entry is PawnLedgerSyncEntry => Boolean(entry));
  if (entries.length === 0) {
    return { ok: true, skipped: true };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      action: "upsertPawnEntries",
      entries,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as SyncResult;
  if (!response.ok || !data.ok) {
    return {
      ok: false,
      error: data.error || `pawn-ledger-sync-${response.status}`,
    };
  }

  return data;
}
