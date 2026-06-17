import "server-only";
import {
  PAWN_STANDARD_INTEREST_RATE,
  PAWN_STANDARD_MAINTENANCE_FEE_THB,
  getPawnChargeSummary,
} from "@/lib/pawn-terms";

type PawnLedgerRow = Record<string, string>;

export type PawnLedgerEntry = {
  rowNumber: number;
  recordId: string;
  assetId: string;
  ownerId: string;
  ownerLineId: string;
  pledgeDate: string;
  borrowerName: string;
  borrowerContact: string;
  cardLabel: string;
  cardCount: number;
  collateralValueTHB: number;
  principalTHB: number;
  monthlyInterestRate: number;
  monthlyInterestTHB: number;
  maintenanceFeeTHB: number;
  totalDueTHB: number;
  dueDate: string;
  status: string;
  note: string;
  staffName: string;
  updatedAt: string;
};

const DEFAULT_PAWN_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1r7tgannnDyOE052jBHk2OOZ23FhJR-5AlO_Tvsy56A4/export?format=csv&gid=0";

const HEADER_ALIASES = {
  recordId: ["record id", "record_id", "id", "เลขรายการ", "รหัสรายการ"],
  assetId: ["asset id", "asset_id", "__sync asset id", "รหัสการ์ด", "asset", "id การ์ด"],
  ownerId: ["owner id", "owner_id", "รหัสผู้ฝาก"],
  ownerLineId: ["owner line id", "owner_line_id", "line id ผู้ฝาก", "line id"],
  rowNumber: ["no", "no.", "ลำดับ", "ลำดับที่", "รายการที่", "เลขที่"],
  pledgeDate: ["วันที่รับฝาก", "วันที่เข้า", "pledgedate", "date", "createdat"],
  borrowerName: ["ชื่อผู้ฝาก", "ผู้ฝาก", "ชื่อลูกค้า", "customer", "borrower", "name"],
  borrowerContact: ["เบอร์ติดต่อ", "ติดต่อ", "line", "line id", "โทร", "phone", "contact"],
  cardLabel: ["การ์ดที่รับฝาก", "รายการการ์ด", "การ์ด", "card", "card name", "รายการ"],
  cardCount: ["จำนวน", "qty", "quantity", "card count", "จำนวนการ์ด"],
  principalTHB: ["ยอดรับฝาก", "เงินต้น", "มูลค่ารับฝาก", "principal", "amount", "ยอดเงิน"],
  collateralValueTHB: ["มูลค่าเต็ม", "มูลค่าจริง", "collateral value", "full value", "value"],
  monthlyInterestRate: ["ดอกเบี้ย", "ดอกเบี้ยต่อเดือน", "%ดอก", "interest rate", "rate"],
  monthlyInterestTHB: ["ดอกเบี้ย/เดือน", "ดอกเบี้ยรายเดือน", "interest", "monthly interest", "ดอก"],
  maintenanceFeeTHB: ["ค่ารักษา", "ค่ารักษา/เดือน", "maintenance fee", "maintenance"],
  totalDueTHB: ["ยอดที่ต้องจ่าย", "ยอดต่อดอก", "total due", "payment due", "total payment"],
  dueDate: ["วันครบกำหนด", "กำหนดคืน", "ครบกำหนด", "duedate", "due date"],
  status: ["สถานะ", "status", "state"],
  note: ["หมายเหตุ", "note", "remark", "memo"],
  staffName: ["ผู้รับเรื่อง", "staff", "พนักงาน", "ผู้ดูแล", "admin"],
  updatedAt: ["อัปเดตล่าสุด", "อัปเดต", "updatedat", "updated at", "timestamp"],
} as const;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function splitCsvRows(csv: string) {
  const rows: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += char + nextChar;
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (current.trim()) {
        rows.push(current);
      }
      current = "";
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    rows.push(current);
  }

  return rows;
}

function parseCsv(csv: string): PawnLedgerRow[] {
  const rows = splitCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    return [];
  }

  const headers = parseCsvLine(rows[0]);
  return rows.slice(1).map((row) => {
    const values = parseCsvLine(row);
    return headers.reduce<PawnLedgerRow>((acc, header, index) => {
      acc[header] = values[index] || "";
      return acc;
    }, {});
  });
}

function normalizeHeader(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_./:()]+/g, "");
}

function normalizeText(value: string) {
  return String(value || "").trim();
}

function getPawnSheetCsvUrl() {
  return String(process.env.PAWN_SHEET_CSV_URL || "").trim() || DEFAULT_PAWN_SHEET_CSV_URL;
}

function getHeaderMap(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeHeader(header),
  }));

  const findHeader = (aliases: readonly string[]) => {
    const normalizedAliases = aliases.map(normalizeHeader);
    return normalizedHeaders.find((header) => normalizedAliases.includes(header.normalized))?.raw || "";
  };

  return {
    rowNumber: findHeader(HEADER_ALIASES.rowNumber),
    recordId: findHeader(HEADER_ALIASES.recordId),
    assetId: findHeader(HEADER_ALIASES.assetId),
    ownerId: findHeader(HEADER_ALIASES.ownerId),
    ownerLineId: findHeader(HEADER_ALIASES.ownerLineId),
    pledgeDate: findHeader(HEADER_ALIASES.pledgeDate),
    borrowerName: findHeader(HEADER_ALIASES.borrowerName),
    borrowerContact: findHeader(HEADER_ALIASES.borrowerContact),
    cardLabel: findHeader(HEADER_ALIASES.cardLabel),
    cardCount: findHeader(HEADER_ALIASES.cardCount),
    collateralValueTHB: findHeader(HEADER_ALIASES.collateralValueTHB),
    principalTHB: findHeader(HEADER_ALIASES.principalTHB),
    monthlyInterestRate: findHeader(HEADER_ALIASES.monthlyInterestRate),
    monthlyInterestTHB: findHeader(HEADER_ALIASES.monthlyInterestTHB),
    maintenanceFeeTHB: findHeader(HEADER_ALIASES.maintenanceFeeTHB),
    totalDueTHB: findHeader(HEADER_ALIASES.totalDueTHB),
    dueDate: findHeader(HEADER_ALIASES.dueDate),
    status: findHeader(HEADER_ALIASES.status),
    note: findHeader(HEADER_ALIASES.note),
    staffName: findHeader(HEADER_ALIASES.staffName),
    updatedAt: findHeader(HEADER_ALIASES.updatedAt),
  };
}

function getComparableRowValue(row: PawnLedgerRow, header: string, fallbackIndex: number) {
  if (header) {
    return String(row[header] || "");
  }

  const values = Object.values(row);
  return String(values[fallbackIndex] || "");
}

function parseNumber(value: string) {
  const cleaned = String(value || "").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateValue(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }
  return text;
}

function normalizeStatus(value: string) {
  const text = normalizeText(value).toLowerCase();
  if (text.includes("หมดสิทธิ์") || text.includes("หลุด") || text.includes("forfeit")) return "หมดสิทธิ์ไถ่ถอน";
  if (text.includes("ปิด") || text.includes("paid") || text.includes("redeem")) return "ปิดบัญชี";
  if (text.includes("ค้าง") || text.includes("overdue")) return "ค้างชำระ";
  if (text.includes("ครบ") || text.includes("due")) return "ครบกำหนด";
  return text || "กำลังใช้งาน";
}

function toEntry(
  row: PawnLedgerRow,
  headerMap: ReturnType<typeof getHeaderMap>,
  fallbackRowNumber: number
): PawnLedgerEntry {
  const rowNumberValue = getComparableRowValue(row, headerMap.rowNumber, 0);
  const ownerIdValue = getComparableRowValue(row, headerMap.ownerId, 13);
  const ownerLineIdValue = getComparableRowValue(row, headerMap.ownerLineId, 2);
  const cardCountValue = getComparableRowValue(row, headerMap.cardCount, 4);
  const collateralValue = getComparableRowValue(row, headerMap.collateralValueTHB, 5);
  const principalValue = getComparableRowValue(row, headerMap.principalTHB, 6);
  const billing = getPawnChargeSummary(
    Math.max(0, parseNumber(principalValue)),
    PAWN_STANDARD_INTEREST_RATE,
    PAWN_STANDARD_MAINTENANCE_FEE_THB
  );

  return {
    rowNumber: Math.max(1, Math.floor(parseNumber(rowNumberValue) || fallbackRowNumber)),
    recordId: normalizeText(getComparableRowValue(row, headerMap.recordId, 0)) || "",
    assetId: normalizeText(getComparableRowValue(row, headerMap.assetId, 13)) || "",
    ownerId: normalizeText(ownerIdValue),
    ownerLineId: normalizeText(ownerLineIdValue),
    pledgeDate: parseDateValue(getComparableRowValue(row, headerMap.pledgeDate, 0)),
    borrowerName: normalizeText(getComparableRowValue(row, headerMap.borrowerName, 1)) || "ไม่ระบุชื่อ",
    borrowerContact: normalizeText(getComparableRowValue(row, headerMap.borrowerContact, 2)),
    cardLabel: normalizeText(getComparableRowValue(row, headerMap.cardLabel, 3)) || "ยังไม่ระบุการ์ด",
    cardCount: Math.max(1, Math.floor(parseNumber(cardCountValue) || 1)),
    collateralValueTHB: Math.max(0, parseNumber(collateralValue || principalValue)),
    principalTHB: Math.max(0, parseNumber(principalValue)),
    monthlyInterestRate: billing.interestRate,
    monthlyInterestTHB: billing.monthlyInterestTHB,
    maintenanceFeeTHB: billing.maintenanceFeeTHB,
    totalDueTHB: billing.totalDueTHB,
    dueDate: parseDateValue(getComparableRowValue(row, headerMap.dueDate, 8)),
    status: normalizeStatus(getComparableRowValue(row, headerMap.status, 9)),
    note: normalizeText(getComparableRowValue(row, headerMap.note, 10)),
    staffName: normalizeText(getComparableRowValue(row, headerMap.staffName, 11)),
    updatedAt: parseDateValue(getComparableRowValue(row, headerMap.updatedAt, 12)),
  };
}

export async function getPawnLedgerEntries() {
  const response = await fetch(getPawnSheetCsvUrl(), {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error("pawn-sheet-unavailable");
  }

  const csv = await response.text();
  const rows = parseCsv(csv);

  if (rows.length === 0) {
    throw new Error("pawn-sheet-empty");
  }

  const headers = Object.keys(rows[0] || {});
  const headerMap = getHeaderMap(headers);

  return rows.map((row, index) => toEntry(row, headerMap, index + 1));
}
