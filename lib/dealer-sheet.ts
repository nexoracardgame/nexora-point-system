import "server-only";

export type DealerSheetVerificationInput = {
  fullName: string;
  memberId: string;
  phone: string;
  nationalId: string;
};

type DealerSheetRow = Record<string, string>;

const DEFAULT_DEALER_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1AhuWH0gU3J7BHObqwBP0fLXdIDc4ED5A6DcI4TWGRQI/export?format=csv&gid=0";

const HEADER_ALIASES = {
  fullName: [
    "ชื่อจริง",
    "ชื่อ-นามสกุล",
    "ชื่อและนามสกุล",
    "ชื่อ",
    "fullname",
    "full name",
    "name",
  ],
  memberId: [
    "รหัสสมาชิก",
    "รหัสตัวแทนจำหน่าย",
    "รหัสตัวแทน",
    "member",
    "memberid",
    "member id",
    "dealerid",
    "dealer id",
    "id member",
  ],
  phone: [
    "เบอร์โทรที่ลงทะเบียน",
    "เบอร์โทร",
    "เบอร์โทรศัพท์",
    "โทรศัพท์",
    "phone",
    "mobile",
    "tel",
  ],
  nationalId: [
    "เลขบัตรประชาชน",
    "เลขบัตรปชช",
    "บัตรประชาชน",
    "เลขประชาชน",
    "nationalid",
    "national id",
    "citizenid",
    "citizen id",
    "idcard",
    "id card",
  ],
  sales: [
    "sales",
    "sale",
    "ยอดขาย",
    "ยอดขายรวม",
    "ยอดขายซองกล่อง",
    "ยอดขายซอง/กล่อง",
    "boxsales",
    "box sales",
  ],
} as const;

function getDealerSheetCsvUrl() {
  return (
    String(process.env.DEALER_SHEET_CSV_URL || "").trim() ||
    DEFAULT_DEALER_SHEET_CSV_URL
  );
}

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

function parseCsv(csv: string): DealerSheetRow[] {
  const rows = splitCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    return [];
  }

  const headers = parseCsvLine(rows[0]);
  return rows.slice(1).map((row) => {
    const values = parseCsvLine(row);
    return headers.reduce<DealerSheetRow>((acc, header, index) => {
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
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeFullName(value: string) {
  return normalizeText(value)
    .replace(/^(นาย|นางสาว|น\.ส\.|นส\.|นาง|เด็กชาย|ด\.ช\.|เด็กหญิง|ด\.ญ\.)\s*/u, "")
    .trim();
}

function normalizeCode(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[\s\-_./]+/g, "");
}

function normalizeDigits(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.startsWith("66") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  if (digits.length === 9) {
    return `0${digits}`;
  }
  return digits;
}

function parseSalesValue(value: string) {
  const normalized = String(value || "").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getHeaderMap(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeHeader(header),
  }));

  const findHeader = (aliases: readonly string[]) => {
    const normalizedAliases = aliases.map(normalizeHeader);
    return (
      normalizedHeaders.find((header) =>
        normalizedAliases.includes(header.normalized)
      )?.raw || ""
    );
  };

  return {
    fullName: findHeader(HEADER_ALIASES.fullName),
    memberId: findHeader(HEADER_ALIASES.memberId),
    phone: findHeader(HEADER_ALIASES.phone),
    nationalId: findHeader(HEADER_ALIASES.nationalId),
    sales: findHeader(HEADER_ALIASES.sales),
  };
}

function getComparableRowValue(
  row: DealerSheetRow,
  header: string,
  fallbackIndex: number
) {
  if (header) {
    return String(row[header] || "");
  }

  const values = Object.values(row);
  return String(values[fallbackIndex] || "");
}

export async function verifyDealerAgainstSheet(
  input: DealerSheetVerificationInput
) {
  const response = await fetch(getDealerSheetCsvUrl(), {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error("dealer-sheet-unavailable");
  }

  const csv = await response.text();
  const rows = parseCsv(csv);

  if (rows.length === 0) {
    throw new Error("dealer-sheet-empty");
  }

  const headers = Object.keys(rows[0] || {});
  const headerMap = getHeaderMap(headers);
  const expected = {
    fullName: normalizeFullName(input.fullName),
    memberId: normalizeCode(input.memberId),
    phone: normalizeDigits(input.phone),
    nationalId: normalizeDigits(input.nationalId),
  };

  return rows.some((row) => {
    const fullName = normalizeFullName(
      getComparableRowValue(row, headerMap.fullName, 0)
    );
    const memberId = normalizeCode(
      getComparableRowValue(row, headerMap.memberId, 1)
    );
    const phone = normalizeDigits(getComparableRowValue(row, headerMap.phone, 2));
    const nationalId = normalizeDigits(
      getComparableRowValue(row, headerMap.nationalId, 3)
    );

    return (
      fullName === expected.fullName &&
      memberId === expected.memberId &&
      phone === expected.phone &&
      nationalId === expected.nationalId
    );
  });
}

export async function getDealerSheetSalesByMemberId(memberId: string) {
  const expectedMemberId = normalizeCode(memberId);
  if (!expectedMemberId) {
    return 0;
  }

  const response = await fetch(getDealerSheetCsvUrl(), {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
  });

  if (!response.ok) {
    return 0;
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return 0;
  }

  const headers = Object.keys(rows[0] || {});
  const headerMap = getHeaderMap(headers);

  const match = rows.find((row) => {
    const rowMemberId = normalizeCode(
      getComparableRowValue(row, headerMap.memberId, 1)
    );
    return rowMemberId === expectedMemberId;
  });

  if (!match) {
    return 0;
  }

  return parseSalesValue(getComparableRowValue(match, headerMap.sales, 0));
}
