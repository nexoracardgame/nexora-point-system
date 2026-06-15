const DEFAULT_SPREADSHEET_ID = "1r7tgannnDyOE052jBHk2OOZ23FhJR-5AlO_Tvsy56A4";
const DEFAULT_SHEET_NAME = "";
const HEADER_ROW = [
  "วันที่จำนำ",
  "ชื่อผู้จำนำ",
  "เบอร์ติดต่อ / LINE",
  "การ์ดที่จำนำ",
  "จำนวน",
  "เงินต้น (THB)",
  "ดอกเบี้ย / เดือน (%)",
  "ดอกเบี้ย / เดือน (THB)",
  "วันครบกำหนด",
  "สถานะ",
  "หมายเหตุ",
  "ผู้รับเรื่อง",
  "อัปเดตล่าสุด",
];
const SYNC_KEY_HEADER = "__Sync Asset ID";
const REMOVED_HEADERS = ["Record ID", "Asset ID", "Owner ID", "Owner Line ID"];

function doGet() {
  return jsonResponse_({
    ok: true,
    name: "NEXORA Pawn Ledger Sync",
    sheetId: getSpreadsheetId_(),
    sheetName: getSheetName_() || "first sheet",
  });
}

function doPost(e) {
  try {
    const payload = parseJsonPayload_(e);
    validateToken_(payload);

    const action = String(payload.action || "upsertPawnEntries").trim();
    if (action !== "upsertPawnEntries" && action !== "upsertPawnEntry") {
      return jsonResponse_({ ok: false, error: "unsupported_action" }, 400);
    }

    const incoming = Array.isArray(payload.entries)
      ? payload.entries
      : payload.entry
        ? [payload.entry]
        : [];

    const entries = incoming
      .map(normalizeEntry_)
      .filter(Boolean);

    if (entries.length === 0) {
      return jsonResponse_({ ok: false, error: "no_entries" }, 400);
    }

    const sheet = getLedgerSheet_();
    ensureHeaderRow_(sheet);
    const result = upsertEntries_(sheet, entries);

    return jsonResponse_({
      ok: true,
      ...result,
    });
  } catch (error) {
    return jsonResponse_(
      {
        ok: false,
        error: error && error.message ? error.message : String(error || "sync_failed"),
      },
      400
    );
  }
}

function getSpreadsheetId_() {
  return String(
    PropertiesService.getScriptProperties().getProperty("PAWN_LEDGER_SPREADSHEET_ID") ||
      DEFAULT_SPREADSHEET_ID
  ).trim();
}

function getSheetName_() {
  return String(
    PropertiesService.getScriptProperties().getProperty("PAWN_LEDGER_SHEET_NAME") ||
      DEFAULT_SHEET_NAME
  ).trim();
}

function getLedgerSheet_() {
  const ss = SpreadsheetApp.openById(getSpreadsheetId_());
  const configuredSheetName = getSheetName_();
  const sheet =
    (configuredSheetName && ss.getSheetByName(configuredSheetName)) ||
    ss.getSheets()[0] ||
    ss.insertSheet(configuredSheetName || "Pawn Ledger");

  return sheet;
}

function ensureHeaderRow_(sheet) {
  const targetHeaders = [...HEADER_ROW, SYNC_KEY_HEADER];
  const lastColumn = Math.max(sheet.getLastColumn(), targetHeaders.length);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const hasAnyValue = existing.some((value) => String(value || "").trim());

  if (!hasAnyValue) {
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    sheet.hideColumns(targetHeaders.length);
    return targetHeaders.slice();
  }

  let currentHeaders = existing.map((value) => String(value || "").trim());
  let currentNormalized = currentHeaders.map(normalizeHeader_);
  let syncColumn = currentNormalized.indexOf(normalizeHeader_(SYNC_KEY_HEADER)) + 1;
  const oldAssetIdColumn = currentNormalized.indexOf(normalizeHeader_("Asset ID")) + 1;

  if (!syncColumn) {
    syncColumn = currentHeaders.length + 1;
    sheet.getRange(1, syncColumn).setValue(SYNC_KEY_HEADER);
    currentHeaders.push(SYNC_KEY_HEADER);
    currentNormalized.push(normalizeHeader_(SYNC_KEY_HEADER));
  }

  if (oldAssetIdColumn && sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, oldAssetIdColumn, sheet.getLastRow() - 1, 1).getValues();
    sheet.getRange(2, syncColumn, values.length, 1).setValues(values);
  }

  REMOVED_HEADERS
    .map((header) => currentNormalized.indexOf(normalizeHeader_(header)) + 1)
    .filter((column) => column > 0)
    .sort((a, b) => b - a)
    .forEach((column) => sheet.deleteColumn(column));

  const refreshedLastColumn = Math.max(sheet.getLastColumn(), targetHeaders.length);
  currentHeaders = sheet.getRange(1, 1, 1, refreshedLastColumn).getValues()[0]
    .map((value) => String(value || "").trim());
  currentNormalized = currentHeaders.map(normalizeHeader_);
  const missing = targetHeaders.filter((header) => !currentNormalized.includes(normalizeHeader_(header)));

  if (missing.length > 0) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]);
    currentHeaders = currentHeaders.concat(missing);
  }

  const finalSyncColumn = currentHeaders.map(normalizeHeader_).indexOf(normalizeHeader_(SYNC_KEY_HEADER)) + 1;
  if (finalSyncColumn) {
    sheet.hideColumns(finalSyncColumn);
  }

  return currentHeaders;
}

function parseJsonPayload_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("invalid_payload");
    }
    return parsed;
  } catch (error) {
    throw new Error("invalid_json");
  }
}

function validateToken_(payload) {
  const expected = String(
    PropertiesService.getScriptProperties().getProperty("PAWN_LEDGER_SYNC_TOKEN") || ""
  ).trim();
  if (!expected) {
    return;
  }

  const provided = String(payload.token || "").trim();
  if (provided !== expected) {
    throw new Error("invalid_token");
  }
}

function normalizeHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_./:()]+/g, "");
}

function normalizeText_(value) {
  return String(value || "").trim();
}

function parseNumber_(value) {
  const cleaned = String(value || "").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate_(value) {
  const text = normalizeText_(value);
  if (!text) return "";
  const date = new Date(text);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  }
  return text;
}

function addDays_(value, days) {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return new Date();
  }
  date.setDate(date.getDate() + days);
  return date;
}

function normalizeEntry_(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const entry = raw;
  const principal = Math.max(0, parseNumber_(entry.principalTHB ?? entry.principal_thb ?? 0));
  const interestRate = Math.max(0, parseNumber_(entry.monthlyInterestRate ?? entry.interestRate ?? 10));
  const interestTHB = Math.max(
    0,
    parseNumber_(entry.monthlyInterestTHB ?? Math.round(principal * (interestRate / 100)))
  );
  const dueDays = Math.max(1, Math.floor(parseNumber_(entry.dueDays ?? 30)) || 30);
  const dueDate =
    normalizeText_(entry.dueDate) ||
    Utilities.formatDate(addDays_(entry.updatedAt || new Date().toISOString(), dueDays), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  const ownerLineId = normalizeText_(entry.ownerLineId || entry.owner_line_id || "");

  return {
    recordId: normalizeText_(entry.recordId || entry.assetId || entry.id || ""),
    assetId: normalizeText_(entry.assetId || entry.id || entry.recordId || ""),
    ownerId: normalizeText_(entry.ownerId || entry.owner_id || ""),
    ownerLineId,
    pledgeDate: parseDate_(entry.pledgeDate || entry.createdAt || entry.updatedAt || new Date().toISOString()),
    borrowerName: normalizeText_(entry.ownerName || entry.borrowerName || "NEXORA Customer"),
    borrowerContact: normalizeText_(entry.borrowerContact || ownerLineId),
    cardLabel: normalizeText_(entry.cardLabel || entry.cardName || "Pawned Card"),
    quantity: Math.max(1, Math.floor(parseNumber_(entry.quantity || 1))),
    principalTHB: principal,
    monthlyInterestRate: interestRate,
    monthlyInterestTHB: interestTHB,
    dueDate,
    status: normalizeText_(entry.status || "กำลังใช้งาน"),
    note: normalizeText_(entry.note || ""),
    staffName: normalizeText_(entry.staffName || "NEXORA Staff"),
    updatedAt: parseDate_(entry.updatedAt || new Date().toISOString()),
  };
}

function buildRow_(entry) {
  return [
    entry.pledgeDate,
    entry.borrowerName,
    entry.borrowerContact,
    entry.cardLabel,
    entry.quantity,
    entry.principalTHB,
    entry.monthlyInterestRate,
    entry.monthlyInterestTHB,
    entry.dueDate,
    entry.status,
    entry.note,
    entry.staffName,
    entry.updatedAt,
    entry.assetId,
  ];
}

function upsertEntries_(sheet, entries) {
  const headers = ensureHeaderRow_(sheet);
  const headerIndex = headers.reduce((acc, header, index) => {
    acc[normalizeHeader_(header)] = index + 1;
    return acc;
  }, {});
  const assetIdColumn =
    headerIndex[normalizeHeader_(SYNC_KEY_HEADER)] ||
    headerIndex[normalizeHeader_("Asset ID")] ||
    0;
  const lastRow = sheet.getLastRow();
  const dataRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];
  let inserted = 0;
  let updated = 0;

  entries.forEach((entry) => {
    const assetId = normalizeText_(entry.assetId);
    if (!assetId) {
      return;
    }

    const rowIndex = assetIdColumn
      ? dataRows.findIndex((row) => normalizeText_(row[assetIdColumn - 1]) === assetId)
      : -1;
    const rowValues = buildRow_(entry);

    if (rowIndex >= 0) {
      sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
      dataRows[rowIndex] = rowValues;
      updated += 1;
      return;
    }

    sheet.appendRow(rowValues);
    inserted += 1;
  });

  return {
    inserted,
    updated,
    total: inserted + updated,
  };
}

function jsonResponse_(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
  return output;
}
