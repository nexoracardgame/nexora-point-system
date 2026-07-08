const SPREADSHEET_ID = "1nL9E-_QI8gRdusTTZVLeeL3SbJQL7-Ud2a11XVwWRZA";
const MEMBER_SPREADSHEET_ID = "1AhuWH0gU3J7BHObqwBP0fLXdIDc4ED5A6DcI4TWGRQI";

const SHEETS = {
  sales: "Sales",
  uploads: "Uploads",
  settings: "Settings",
  stockCredits: "Stock Credits",
  manualSales: "Manual Sales",
  branchReportSubmissions: "Branch Report Submissions",
  branchReportLines: "Branch Report Lines",
};

const SALES_HEADERS = [
  "Sale ID",
  "Upload ID",
  "Month",
  "Sale Date",
  "Employee Code",
  "Employee Name",
  "Invoice No",
  "Customer",
  "Item",
  "Quantity",
  "Sale Amount",
  "Commission Rate",
  "Commission Amount",
  "Source Row",
  "Notes",
  "Imported At",
  "Branch",
  "Phone",
  "Bank",
  "Account No",
  "Account Name",
  "Box Bronze",
  "Box Silver",
  "Box Gold",
  "Pack Bronze",
  "Pack Silver",
  "Pack Gold",
  "Silver Egg",
  "Gold Egg",
  "Other Qty",
];

const UPLOAD_HEADERS = [
  "Upload ID",
  "Month",
  "File Name",
  "Rows Imported",
  "Total Sales",
  "Total Commission",
  "Uploaded By",
  "Uploaded At",
  "Status",
];

const SETTINGS_HEADERS = ["Key", "Value", "Notes"];
const STOCK_CREDIT_HEADERS = [
  "Credit ID",
  "Branch",
  "Item Key",
  "Item",
  "Quantity",
  "Credit Date",
  "Created At",
  "Created By",
];
const MANUAL_SALES_HEADERS = [
  "Manual ID",
  "Branch",
  "Item Key",
  "Item",
  "Quantity",
  "Unit Price",
  "Sale Amount",
  "Commission Rate",
  "Commission Amount",
  "Cleared At",
  "Created By",
];
const BRANCH_REPORT_SUBMISSION_HEADERS = [
  "Submission ID",
  "Report ID",
  "Branch",
  "Month",
  "Cycle Start",
  "Cycle End",
  "Status",
  "Submitted At",
  "Submitted By",
  "Reviewed At",
  "Reviewed By",
  "Notes",
];
const BRANCH_REPORT_LINE_HEADERS = [
  "Submission ID",
  "Branch",
  "Month",
  "Employee Code",
  "Employee Name",
  "Box Bronze",
  "Box Silver",
  "Box Gold",
  "Notes",
];
const DATE_TIME_HEADERS_ = ["Sale Date", "Imported At", "Uploaded At"];
const STOCK_BOX_PRICES = {
  boxBronze: 650,
  boxSilver: 1100,
  boxGold: 1650,
};
const DATA_REPAIR_VERSION = "2026-07-01-tg-15-rate-v1";
const DEFAULT_ADMIN_PIN = "nex9959979";
const DEFAULT_COMMISSION_RATE = 10;
const BRANCH_COMMISSION_RATES = {
  TG: 15,
};
const BRANCH_REPORT_PINS = {
  TG: "tg63",
  CG: "cg63",
  NNT: "nnt63",
};
const FIXED_BRANCH_REPORT_EMPLOYEES = {
  CG: [
    { employeeCode: "N-U2463", employeeName: "โบว์", nickname: "โบว์", phone: "094 454 4505" },
    { employeeCode: "N-N1979", employeeName: "เนิอร์ซ", nickname: "เนิอร์ซ", phone: "064 079 9897" },
    { employeeCode: "N-N7989", employeeName: "เนเน่", nickname: "เนเน่", phone: "092 419 9505" },
    { employeeCode: "N-S0014", employeeName: "บีม", nickname: "บีม", phone: "087 558 7718" },
    { employeeCode: "N-P9247", employeeName: "เฟิร์น", nickname: "เฟิร์น", phone: "061 584 7424" },
    { employeeCode: "N-S0044", employeeName: "อ้อ", nickname: "อ้อ", phone: "094 509 4244" },
    { employeeCode: "N-S0054", employeeName: "ออย", nickname: "ออย", phone: "095 917 9654" },
    { employeeCode: "N-S1709", employeeName: "นิด", nickname: "นิด", phone: "097 173 1184" },
    { employeeCode: "N-K0017", employeeName: "กุ้ง", nickname: "กุ้ง", phone: "092 568 1914" },
    { employeeCode: "N-S0089", employeeName: "เต๋า", nickname: "เต๋า", phone: "086 359 7381" },
    { employeeCode: "N-S0017", employeeName: "ปอน", nickname: "ปอน", phone: "092 364 6540" },
    { employeeCode: "N-P1910", employeeName: "เอก", nickname: "เอก", phone: "064 456 2579" },
    { employeeCode: "N-S0001", employeeName: "แบงค์", nickname: "แบงค์", phone: "096 896 5185" },
    { employeeCode: "N-S0003", employeeName: "สร", nickname: "สร", phone: "065 678 8116" },
    { employeeCode: "N-P0008", employeeName: "หนุ่ย", nickname: "หนุ่ย", phone: "081 457 8537" },
    { employeeCode: "N-P0978", employeeName: "ป่า", nickname: "ป่า", phone: "081 633 1053" },
    { employeeCode: "N-S0007", employeeName: "เบียร์", nickname: "เบียร์", phone: "095 552 5280" },
    { employeeCode: "N-S1467", employeeName: "กาย", nickname: "กาย", phone: "094 757 1467" },
  ],
  NNT: [
    { employeeCode: "N-N6969", employeeName: "จ๋า", nickname: "จ๋า", phone: "063-565-4636" },
    { employeeCode: "N-J8888", employeeName: "เจนนี่", nickname: "เจนนี่", phone: "081-394-4574" },
    { employeeCode: "N-BB8888", employeeName: "บี", nickname: "บี", phone: "061-234-5150" },
    { employeeCode: "N-T0007", employeeName: "ทิว", nickname: "ทิว", phone: "061-549-8682" },
    { employeeCode: "N-T7788", employeeName: "โต", nickname: "โต", phone: "092-417-6333" },
    { employeeCode: "N-A1234", employeeName: "อ๋อ", nickname: "อ๋อ", phone: "099-615-4120" },
    { employeeCode: "N-A7200", employeeName: "แอน", nickname: "แอน", phone: "096-205-4132" },
    { employeeCode: "N-G1112", employeeName: "กอล์ฟ", nickname: "กอล์ฟ", phone: "092-361-4639" },
    { employeeCode: "N-F7798", employeeName: "เฟิร์ส", nickname: "เฟิร์ส", phone: "092-316-8624" },
    { employeeCode: "N-B7799", employeeName: "บีม", nickname: "บีม", phone: "063-205-6326" },
    { employeeCode: "N-P2502", employeeName: "พี", nickname: "พี", phone: "080-992-3391" },
  ],
};
const SPECIAL_COMMISSION_RULES = [
  { codes: ["N-B8888"], names: ["นายธนะบอมฐ์ โชควรเตชะทรัพย์", "ธนะบอมฐ์ โชควรเตชะทรัพย์"], rate: 15, branch: "TG" },
  { codes: ["N-M5555"], names: ["นางสาวอรัญญา คำเจริญ", "อรัญญา คำเจริญ"], rate: 15, branch: "TG" },
];
const SPECIAL_TG_INVENTORY_MEMBER_CODES = ["N-B8888", "N-M5555"];
const BRANCHES = [
  { code: "NEX", name: "NEX" },
  { code: "TG", name: "TG" },
  { code: "CG", name: "CG" },
  { code: "NNT", name: "NNT" },
  { code: "GENERAL", name: "เครือข่ายทั่วไป" },
];

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("NECSHORA 63 CO., LTD. Commission")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupDatabase() {
  setupDatabase_();
  return getAdminState();
}

function repairRestoreCgJuneReport() {
  setupDatabase_();
  const branch = "CG";
  const cycle = getReportCycleForMonth_("2026-06");
  const reportId = getBranchReportId_(branch, cycle);
  const submissionId = "BRS-20260703-131353-CG-5565";
  const submissionSheet = getSheet_(SHEETS.branchReportSubmissions);
  const lineSheet = getSheet_(SHEETS.branchReportLines);
  const salesSheet = getSheet_(SHEETS.sales);
  const existingSales = readObjects_(salesSheet).filter((row) => String(row["Upload ID"] || "").trim() === reportId);
  const existingSubmission = readObjects_(submissionSheet).filter((row) => String(row["Submission ID"] || "").trim() === submissionId);
  if (existingSales.length || existingSubmission.length) {
    return {
      ok: true,
      skipped: true,
      reason: "CG June report already exists",
      salesRows: existingSales.length,
      submissions: existingSubmission.length,
    };
  }

  const submittedAt = new Date("2026-07-03T13:13:54+07:00");
  const reviewedAt = new Date("2026-07-03T14:02:00+07:00");
  submissionSheet.appendRow([
    submissionId,
    reportId,
    branch,
    cycle.month,
    cycle.start,
    cycle.end,
    "APPROVED",
    submittedAt,
    branch,
    reviewedAt,
    "admin",
    "Restored after removing duplicated July/June CG rows",
  ]);

  const lines = [
    { employeeCode: "N-U2463", employeeName: "นางสาวกัลณลักษณ์ อริธรรณวัธน์", boxBronze: 3, boxSilver: 22, boxGold: 11 },
    { employeeCode: "N-N7989", employeeName: "นางสาวรัญนรัจน์ เตชธรรมเศรษฐ์", boxBronze: 0, boxSilver: 0, boxGold: 2 },
    { employeeCode: "N-S0044", employeeName: "นางสาวอังคณา พุ่มวัฒน์", boxBronze: 1, boxSilver: 0, boxGold: 0 },
    { employeeCode: "N-K0017", employeeName: "นายสรัณย์ญู ทับทิม", boxBronze: 0, boxSilver: 0, boxGold: 1 },
    { employeeCode: "N-S0017", employeeName: "นายณัฐพล พลูเอียม", boxBronze: 1, boxSilver: 0, boxGold: 0 },
  ];
  lineSheet.getRange(lineSheet.getLastRow() + 1, 1, lines.length, BRANCH_REPORT_LINE_HEADERS.length).setValues(lines.map((line) => [
    submissionId,
    branch,
    cycle.month,
    line.employeeCode,
    line.employeeName,
    line.boxBronze,
    line.boxSilver,
    line.boxGold,
    "",
  ]));

  const salesRows = createSalesRowsFromBranchReport_({
    reportId,
    branch,
    month: cycle.month,
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
  }, lines.map((line) => ({
    employeeCode: line.employeeCode,
    employeeName: line.employeeName,
    boxBronze: line.boxBronze,
    boxSilver: line.boxSilver,
    boxGold: line.boxGold,
    notes: "Restored CG June report",
  })));
  if (salesRows.length) {
    salesSheet.getRange(salesSheet.getLastRow() + 1, 1, salesRows.length, SALES_HEADERS.length).setValues(salesRows);
  }
  formatDatabase_();
  return {
    ok: true,
    restored: true,
    reportId,
    submissionId,
    lines: lines.length,
    salesRows: salesRows.length,
  };
}

function getPublicState() {
  setupDatabase_();
  return {
    ok: true,
    months: getMonths_(),
    rate: getCommissionRate_(),
    reportCycle: getCommissionCycle_(),
  };
}

function getBranchReportState(branchCode, pin, monthKey) {
  setupDatabase_();
  const branch = validateBranchReportPin_(branchCode, pin);
  if (String(monthKey || "").trim() === "") {
    return getAllBranchReportState_(branch);
  }
  const cycle = getReportCycleForMonth_(monthKey);
  const reportId = getBranchReportId_(branch, cycle);
  const submission = getLatestBranchReportSubmission_(branch, cycle);
  const approvedRows = submission.submissionId ? [] : readBranchReportEntries_(branch, cycle);
  const savedEntries = submission.submissionId ? readBranchReportLines_(submission.submissionId) : approvedRows;
  const fallbackStatus = approvedRows.length ? "APPROVED" : "";
  const reportStatus = submission.status || fallbackStatus;
  const isLocked = reportStatus === "PENDING" || reportStatus === "APPROVED";
  return {
    ok: true,
    branch,
    branchName: branch,
    cycle,
    reportId,
    reportMonths: getBranchReportMonths_(branch),
    selectedMonth: cycle.month,
    submitted: isLocked,
    reportStatus,
    submission,
    savedEntries,
    rate: getCommissionRateForBranch_(branch) || DEFAULT_COMMISSION_RATE,
    prices: STOCK_BOX_PRICES,
    inventorySummary: getBranchInventorySummaryForReport_(branch),
    employees: getBranchReportEmployees_(branch),
  };
}

function getAllBranchReportState_(branch) {
  const savedEntries = getAllBranchReportEntries_(branch);
  return {
    ok: true,
    branch,
    branchName: branch,
    cycle: {},
    reportId: "",
    reportMonths: getBranchReportMonths_(branch),
    selectedMonth: "",
    submitted: true,
    reportStatus: "ALL",
    submission: {},
    savedEntries,
    rate: getCommissionRateForBranch_(branch) || DEFAULT_COMMISSION_RATE,
    prices: STOCK_BOX_PRICES,
    inventorySummary: getBranchInventorySummaryForReport_(branch),
    employees: getBranchReportEmployees_(branch),
  };
}

function getAllBranchReportEntries_(branchCode) {
  const branch = normalizeBranch_(branchCode);
  const activeSubmissionIds = {};
  readObjects_(getSheet_(SHEETS.branchReportSubmissions)).forEach((row) => {
    const status = String(row.Status || "").trim().toUpperCase();
    if (normalizeBranch_(row.Branch) === branch && (status === "PENDING" || status === "APPROVED")) {
      activeSubmissionIds[String(row["Submission ID"] || "").trim()] = true;
    }
  });
  const byEmployee = {};
  readObjects_(getSheet_(SHEETS.branchReportLines)).forEach((row) => {
    const submissionId = String(row["Submission ID"] || "").trim();
    if (!activeSubmissionIds[submissionId] || normalizeBranch_(row.Branch) !== branch) return;
    const employeeCode = String(row["Employee Code"] || "").trim();
    if (!employeeCode) return;
    if (!byEmployee[employeeCode]) {
      byEmployee[employeeCode] = {
        employeeCode,
        employeeName: String(row["Employee Name"] || "").trim(),
        nickname: getBranchReportNickname_(branch, employeeCode, row["Employee Name"]),
        boxBronze: 0,
        boxSilver: 0,
        boxGold: 0,
        notes: "",
      };
    }
    byEmployee[employeeCode].boxBronze += parseNumber_(row["Box Bronze"]);
    byEmployee[employeeCode].boxSilver += parseNumber_(row["Box Silver"]);
    byEmployee[employeeCode].boxGold += parseNumber_(row["Box Gold"]);
  });
  return Object.values(byEmployee);
}

function submitBranchSalesReport(branchCode, pin, monthKey, entries) {
  setupDatabase_();
  const branch = validateBranchReportPin_(branchCode, pin);
  const cycle = getReportCycleForMonth_(monthKey);
  const rate = getCommissionRateForBranch_(branch) || DEFAULT_COMMISSION_RATE;
  const reportId = getBranchReportId_(branch, cycle);
  const existingSubmission = getLatestBranchReportSubmission_(branch, cycle);
  if (existingSubmission.status === "PENDING") {
    throw new Error("This report is waiting for admin approval.");
  }
  if (existingSubmission.status === "APPROVED") {
    throw new Error("This commission month has already been approved.");
  }
  if (!existingSubmission.status && readBranchReportEntries_(branch, cycle).length) {
    throw new Error("This commission month has already been approved.");
  }
  const now = new Date();
  const month = cycle.month || normalizeMonth_(cycle.end) || Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM");
  const memberRows = getMemberRows_();
  const lineRows = [];
  const normalizedEntries = (entries || []).map((entry) => {
    const employeeCode = String(entry && entry.employeeCode || "").trim();
    const member = findMemberInRows_(employeeCode, memberRows);
    const employeeName = member.realName || String(entry && entry.employeeName || "").trim() || employeeCode;
    const bronze = Math.max(0, parseNumber_(entry && entry.boxBronze));
    const silver = Math.max(0, parseNumber_(entry && entry.boxSilver));
    const gold = Math.max(0, parseNumber_(entry && entry.boxGold));
    const entryNotes = String(entry && entry.notes || "").trim();
    const totalBoxes = bronze + silver + gold;
    if (!employeeCode || totalBoxes <= 0) return null;
    return { employeeCode, employeeName, bronze, silver, gold, entryNotes };
  }).filter(Boolean);

  if (!normalizedEntries.length) {
    throw new Error("Please enter at least one sales box quantity.");
  }
  validateBranchReportAgainstStock_(branch, normalizedEntries);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const submissionId = "BRS-" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd-HHmmss") + "-" + branch + "-" + Math.floor(Math.random() * 10000);
    getSheet_(SHEETS.branchReportSubmissions).appendRow([
      submissionId,
      reportId,
      branch,
      month,
      cycle.start,
      cycle.end,
      "PENDING",
      now,
      branch,
      "",
      "",
      "",
    ]);
    normalizedEntries.forEach((entry) => {
      lineRows.push([
        submissionId,
        branch,
        month,
        entry.employeeCode,
        entry.employeeName,
        entry.bronze,
        entry.silver,
        entry.gold,
        entry.entryNotes,
      ]);
    });
    getSheet_(SHEETS.branchReportLines).getRange(
      getSheet_(SHEETS.branchReportLines).getLastRow() + 1,
      1,
      lineRows.length,
      BRANCH_REPORT_LINE_HEADERS.length
    ).setValues(lineRows);
    formatDatabase_();
    return {
      ok: true,
      reportId,
      submissionId,
      deletedRows: 0,
      rowsSaved: lineRows.length,
      totalSales: normalizedEntries.reduce((sum, entry) => sum + entry.bronze * STOCK_BOX_PRICES.boxBronze + entry.silver * STOCK_BOX_PRICES.boxSilver + entry.gold * STOCK_BOX_PRICES.boxGold, 0),
      totalCommission: normalizedEntries.reduce((sum, entry) => sum + (entry.bronze * STOCK_BOX_PRICES.boxBronze + entry.silver * STOCK_BOX_PRICES.boxSilver + entry.gold * STOCK_BOX_PRICES.boxGold) * rate / 100, 0),
      state: getBranchReportState(branch, pin, cycle.month),
      adminState: getAdminState(),
    };
  } finally {
    lock.releaseLock();
  }
}

function getAdminState(pin) {
  setupDatabase_();
  if (pin !== undefined) {
    validateAdminPin_(pin);
  }
  const salesRows = readSalesRows_();
  const stockCredits = readStockCredits_();
  const manualSales = readManualSales_();
  const uploads = readObjects_(getSheet_(SHEETS.uploads)).sort((a, b) => {
    return String(b["Uploaded At"] || "").localeCompare(String(a["Uploaded At"] || ""));
  });

  return {
    ok: true,
    months: getMonthsFromRows_(salesRows),
    settings: getSettingsObject_(),
    uploads,
    branchSummary: getBranchSummaryFromRows_(salesRows, stockCredits, manualSales),
    pendingReports: getPendingBranchReports_(),
    sheetsUrl: "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/edit",
  };
}

function updateSettings(pin, settings) {
  validateAdminPin_(pin);
  setupDatabase_();

  const updates = settings || {};
  if (updates.adminPin !== undefined && String(updates.adminPin).trim().length >= 4) {
    setSetting_("ADMIN_PIN", String(updates.adminPin).trim(), "Admin passcode");
  }

  return getAdminState();
}

function deleteUpload(pin, uploadId) {
  validateAdminPin_(pin);
  setupDatabase_();

  const id = String(uploadId || "").trim();
  if (!id) {
    throw new Error("Missing upload ID.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const salesDeleted = deleteRowsByHeaderValue_(getSheet_(SHEETS.sales), "Upload ID", id);
    const uploadsDeleted = deleteRowsByHeaderValue_(getSheet_(SHEETS.uploads), "Upload ID", id);

    if (!uploadsDeleted) {
      throw new Error("Upload file not found.");
    }

    formatDatabase_();
    const state = getAdminState(pin);
    state.deletedUpload = {
      uploadId: id,
      uploadRows: uploadsDeleted,
      salesRows: salesDeleted,
    };
    return state;
  } finally {
    lock.releaseLock();
  }
}

function approveBranchReport(pin, submissionId) {
  validateAdminPin_(pin);
  setupDatabase_();
  const submission = findBranchReportSubmissionById_(submissionId);
  if (!submission.submissionId || submission.status !== "PENDING") {
    throw new Error("Branch report is not pending approval.");
  }
  const lines = readBranchReportLines_(submission.submissionId);
  if (!lines.length) {
    throw new Error("Branch report has no rows.");
  }
  validateBranchReportAgainstStock_(submission.branch, lines.map((line) => ({
    bronze: line.boxBronze,
    silver: line.boxSilver,
    gold: line.boxGold,
  })));

  const rows = createSalesRowsFromBranchReport_(submission, lines);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    getSheet_(SHEETS.sales).getRange(getSheet_(SHEETS.sales).getLastRow() + 1, 1, rows.length, SALES_HEADERS.length).setValues(rows);
    updateBranchReportSubmissionStatus_(submission.submissionId, "APPROVED", "admin", "");
    formatDatabase_();
    return getAdminState(pin);
  } finally {
    lock.releaseLock();
  }
}

function rejectBranchReport(pin, submissionId) {
  validateAdminPin_(pin);
  setupDatabase_();
  const submission = findBranchReportSubmissionById_(submissionId);
  if (!submission.submissionId || submission.status !== "PENDING") {
    throw new Error("Branch report is not pending approval.");
  }
  updateBranchReportSubmissionStatus_(submission.submissionId, "REJECTED", "admin", "Rejected by admin");
  formatDatabase_();
  return getAdminState(pin);
}

function addStockCredit(pin, branchCode, credits) {
  validateAdminPin_(pin);
  setupDatabase_();

  const branch = normalizeBranch_(branchCode);
  if (["TG", "CG", "NNT"].indexOf(branch) < 0) {
    throw new Error("Stock credit is available for TG, CG, and NNT only.");
  }

  const rows = (credits || []).map((entry) => {
    const itemKey = normalizeStockItemKey_(entry && entry.itemKey);
    const quantity = parseNumber_(entry && entry.quantity);
    const creditDate = normalizeDateValue_(entry && entry.date);
    if (!itemKey || quantity <= 0) return null;
    if (!creditDate) {
      throw new Error("Please select stock credit date.");
    }
    const now = new Date();
    return [
      "SC-" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd-HHmmss") + "-" + itemKey + "-" + Math.floor(Math.random() * 10000),
      branch,
      itemKey,
      getStockItemLabel_(itemKey),
      quantity,
      creditDate,
      now,
      "admin",
    ];
  }).filter(Boolean);

  if (!rows.length) {
    throw new Error("Please enter at least one stock credit quantity.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet_(SHEETS.stockCredits);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, STOCK_CREDIT_HEADERS.length).setValues(rows);
    formatDatabase_();
    return getAdminState(pin);
  } finally {
    lock.releaseLock();
  }
}

function deleteStockCredit(pin, creditId) {
  validateAdminPin_(pin);
  setupDatabase_();

  const id = String(creditId || "").trim();
  if (!id) {
    throw new Error("Missing stock credit ID.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const deleted = deleteRowsByHeaderValue_(getSheet_(SHEETS.stockCredits), "Credit ID", id);
    if (!deleted) {
      throw new Error("Stock credit lot not found.");
    }

    formatDatabase_();
    const state = getAdminState(pin);
    state.deletedStockCredit = {
      creditId: id,
      rows: deleted,
    };
    return state;
  } finally {
    lock.releaseLock();
  }
}

function addManualSales(pin, branchCode, sales) {
  validateAdminPin_(pin);
  setupDatabase_();

  const branch = normalizeBranch_(branchCode);
  if (["TG", "CG", "NNT"].indexOf(branch) < 0) {
    throw new Error("Manual clear is available for TG, CG, and NNT only.");
  }

  const now = new Date();
  const rows = (sales || []).map((entry) => {
    const itemKey = normalizeStockItemKey_(entry && entry.itemKey);
    const quantity = parseNumber_(entry && entry.quantity);
    if (!itemKey || quantity <= 0) return null;
    const unitPrice = STOCK_BOX_PRICES[itemKey] || 0;
    const saleAmount = quantity * unitPrice;
    const commissionRate = getCommissionRateForBranch_(branch) || DEFAULT_COMMISSION_RATE;
    const commissionAmount = saleAmount * commissionRate / 100;
    return [
      "MS-" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd-HHmmss") + "-" + itemKey + "-" + Math.floor(Math.random() * 10000),
      branch,
      itemKey,
      getStockItemLabel_(itemKey),
      quantity,
      unitPrice,
      saleAmount,
      commissionRate,
      commissionAmount,
      now,
      "admin",
    ];
  }).filter(Boolean);

  if (!rows.length) {
    throw new Error("Please enter at least one manual sale quantity.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet_(SHEETS.manualSales);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, MANUAL_SALES_HEADERS.length).setValues(rows);
    formatDatabase_();
    return getAdminState(pin);
  } finally {
    lock.releaseLock();
  }
}

function getEmployeeSummary(employeeCode, month) {
  const code = String(employeeCode || "").trim();
  if (!code) {
    throw new Error("Please enter employee code.");
  }

  const members = getMemberRows_();
  const member = findMemberInRows_(code, members);
  const memberKeys = getMemberMatchKeys_(code, member);
  const selectedMonth = String(month || "").trim();
  const allRows = readSalesRows_(members);
  const selectedMonthKey = normalizeMonth_(selectedMonth);
  const rows = allRows.filter((row) => {
    const saleKeys = [
      row["Employee Code"],
      row["Employee Name"],
      row.Customer,
    ].map(normalizeMemberKey_);
    return saleKeys.some((key) => memberKeys.indexOf(key) >= 0);
  });

  const byMonth = {};
  const productTotals = getEmptyProductTotals_();
  const profile = {
    branch: member.branch || "",
    realName: member.realName || "",
    nickname: member.nickname || "",
    bgImage: member.bgImage || "",
  };
  let employeeName = member.displayName || "";
  rows.forEach((row) => {
    const rowMonth = normalizeMonth_(row.Month) || String(row.Month || "Unknown");
    if (!byMonth[rowMonth]) {
      byMonth[rowMonth] = {
        month: rowMonth,
        totalSales: 0,
        totalCommission: 0,
        count: 0,
      };
    }
    byMonth[rowMonth].totalSales += parseNumber_(row["Sale Amount"]);
    byMonth[rowMonth].totalCommission += parseNumber_(row["Commission Amount"]);
    byMonth[rowMonth].count += 1;
    addProductTotals_(productTotals, row);
    if (!employeeName && row["Employee Name"]) {
      employeeName = row["Employee Name"];
    }
    if (!profile.branch && row.Branch) profile.branch = row.Branch;
  });

  const totals = Object.values(byMonth).reduce((acc, row) => {
    acc.totalSales += row.totalSales;
    acc.totalCommission += row.totalCommission;
    acc.count += row.count;
    return acc;
  }, { totalSales: 0, totalCommission: 0, count: 0 });
  const memberTotals = Object.assign({}, totals);
  const specialTgInventorySummary = getSpecialTgInventorySummaryForMember_(member.memberCode || code);
  if (specialTgInventorySummary.isSpecial) {
    totals.totalSales += specialTgInventorySummary.totalSales;
    totals.totalCommission += specialTgInventorySummary.totalCommission;
    totals.count += specialTgInventorySummary.rowCount;
  }

  return {
    ok: true,
    employeeCode: member.memberCode || code,
    employeeName: employeeName || "ไม่พบชื่อในข้อมูล",
    memberFound: Boolean(member.memberCode),
    selectedMonth,
    months: Object.values(byMonth).sort((a, b) => String(b.month).localeCompare(String(a.month))),
    sales: rows
      .filter((row) => !selectedMonthKey || normalizeMonth_(row.Month) === selectedMonthKey)
      .sort(sortSalesNewestFirst_),
    allSales: rows.sort(sortSalesNewestFirst_),
    totals,
    memberTotals,
    specialTgInventorySummary,
    productTotals,
    profile,
    availableMonths: getMonthsFromRows_(allRows),
  };
}

function previewExcelUpload(pin, payload) {
  validateAdminPin_(pin);
  setupDatabase_();
  const workbook = convertExcelPayload_(payload);
  const sheet = workbook.spreadsheet.getSheets()[0];
  const values = sheet.getDataRange().getDisplayValues();
  cleanupConvertedFile_(workbook.fileId);

  if (values.length < 2) {
    throw new Error("The uploaded file has no data rows.");
  }

  const layout = detectHeaderLayout_(values);
  return {
    ok: true,
    headers: layout.headers,
    headerRowIndex: layout.headerRowIndex,
    dataStartIndex: layout.dataStartIndex,
    sampleRows: values.slice(layout.dataStartIndex, layout.dataStartIndex + 5),
    guessedMapping: guessMapping_(layout.headers),
  };
}

function importExcelUpload(pin, payload, options) {
  validateAdminPin_(pin);
  setupDatabase_();

  const month = normalizeMonth_(options && options.month);
  if (!month) {
    throw new Error("Please select upload month.");
  }

  if (isDocumentPayload_(payload)) {
    return importDocumentUpload_(pin, payload, options, month);
  }

  const workbook = convertExcelPayload_(payload);
  const values = workbook.spreadsheet.getSheets()[0].getDataRange().getValues();
  cleanupConvertedFile_(workbook.fileId);

  const layout = detectHeaderLayout_(values);
  const dataStartIndex = layout.dataStartIndex;
  const headers = layout.headers;
  const mapping = guessMapping_(headers);
  const uploadBranch = normalizeBranch_(options && options.branch) || "GENERAL";
  if (!isSelectedColumn_(mapping.employeeCode) || !isSelectedColumn_(mapping.saleAmount)) {
    throw new Error("ระบบอ่านไฟล์นี้ไม่ได้: ไม่พบคอลัมน์รหัส/ชื่อสมาชิก หรือยอดขายในไฟล์ POS");
  }
  const dataRows = isPosDocumentReport_(headers)
    ? expandPosDocumentRows_(values.slice(dataStartIndex), headers)
    : values.slice(dataStartIndex);
  const now = new Date();
  const uploadId = "UP-" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd-HHmmss");
  const salesRows = [];
  const members = getMemberRows_();

  dataRows.forEach((row, rowIndex) => {
    const employeeName = getMappedValue_(row, mapping.employeeName);
    const rawEmployeeCode = getMappedValue_(row, mapping.employeeCode) || employeeName;
    const saleAmount = parseNumber_(getMappedValue_(row, mapping.saleAmount));
    if (!rawEmployeeCode || saleAmount <= 0) {
      return;
    }
    const customerName = getMappedValue_(row, mapping.customer);
    const matchedMember = [
      [rawEmployeeCode, employeeName, customerName].join(" "),
      rawEmployeeCode,
      employeeName,
      customerName,
    ].map((key) => findMemberInRows_(key, members)).find((member) => member.memberCode) || {};
    const employeeCode = matchedMember.memberCode || rawEmployeeCode;
    const finalEmployeeName = matchedMember.realName || employeeName;

    const saleDate = getMappedValue_(row, mapping.saleDate);
    const itemName = getMappedValue_(row, mapping.item);
    const productBreakdown = getProductBreakdown_(
      [itemName, getMappedValue_(row, mapping.productCode)].join(" "),
      parseNumber_(getMappedValue_(row, mapping.quantity))
    );
    const rule = getCommissionRule_([finalEmployeeName, employeeCode, customerName, matchedMember.nickname].join(" "));
    const branch = rule.branch || normalizeBranch_(matchedMember.branch || getMappedValue_(row, mapping.branch) || uploadBranch);
    const rate = getCommissionRateForBranch_(branch) || rule.rate;
    const commissionAmount = roundMoney_(saleAmount * rate / 100);
    const saleId = [
      uploadId,
      rowIndex + 2,
      String(employeeCode).trim(),
      Utilities.getUuid().slice(0, 8),
    ].join("-");

    salesRows.push([
      saleId,
      uploadId,
      month,
      normalizeDateValue_(saleDate) || month + "-01",
      String(employeeCode).trim(),
      finalEmployeeName,
      getMappedValue_(row, mapping.invoiceNo),
      customerName,
      itemName,
      parseNumber_(getMappedValue_(row, mapping.quantity)) || "",
      saleAmount,
      rate,
      commissionAmount,
      rowIndex + 2,
      getMappedValue_(row, mapping.notes),
      now,
      branch,
      getMappedValue_(row, mapping.phone),
      getMappedValue_(row, mapping.bank),
      getMappedValue_(row, mapping.accountNo),
      getMappedValue_(row, mapping.accountName),
      parseNumber_(getMappedValue_(row, mapping.boxBronze)) || productBreakdown.boxBronze || "",
      parseNumber_(getMappedValue_(row, mapping.boxSilver)) || productBreakdown.boxSilver || "",
      parseNumber_(getMappedValue_(row, mapping.boxGold)) || productBreakdown.boxGold || "",
      parseNumber_(getMappedValue_(row, mapping.packBronze)) || productBreakdown.packBronze || "",
      parseNumber_(getMappedValue_(row, mapping.packSilver)) || productBreakdown.packSilver || "",
      parseNumber_(getMappedValue_(row, mapping.packGold)) || productBreakdown.packGold || "",
      parseNumber_(getMappedValue_(row, mapping.silverEgg)) || productBreakdown.silverEgg || "",
      parseNumber_(getMappedValue_(row, mapping.goldEgg)) || productBreakdown.goldEgg || "",
      parseNumber_(getMappedValue_(row, mapping.otherQty)) || productBreakdown.otherQty || "",
    ]);
  });

  if (!salesRows.length) {
    throw new Error("No valid sales rows found. Please check the selected columns.");
  }

  const salesSheet = getSheet_(SHEETS.sales);
  salesSheet
    .getRange(salesSheet.getLastRow() + 1, 1, salesRows.length, SALES_HEADERS.length)
    .setValues(salesRows);

  const totalSales = salesRows.reduce((sum, row) => sum + parseNumber_(row[SALES_HEADERS.indexOf("Sale Amount")]), 0);
  const totalCommission = salesRows.reduce((sum, row) => sum + parseNumber_(row[SALES_HEADERS.indexOf("Commission Amount")]), 0);
  getSheet_(SHEETS.uploads).appendRow([
    uploadId,
    month,
    payload && payload.name ? payload.name : "uploaded.xlsx",
    salesRows.length,
    totalSales,
    totalCommission,
    "admin",
    now,
    "Imported",
  ]);

  formatDatabase_();
  return getAdminState(pin);
}

function importDocumentUpload_(pin, payload, options, month) {
  const uploadBranch = normalizeBranch_(options && options.branch) || "NNT";
  const now = new Date();
  const uploadId = "UP-" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd-HHmmss");
  const documentData = extractUploadDocumentData_(payload);
  const members = getMemberRows_();
  const parsedRows = parseNntPdfRows_(documentData, {
    month,
    uploadId,
    uploadBranch,
    now,
    members,
  });

  if (!parsedRows.length) {
    throw new Error("ระบบอ่านไฟล์เอกสารนี้ไม่ได้: ไม่พบแถวรหัสสมาชิก/ชื่อ และยอดขาย กรุณาตรวจไฟล์ NNT อีกครั้ง");
  }

  const salesSheet = getSheet_(SHEETS.sales);
  salesSheet
    .getRange(salesSheet.getLastRow() + 1, 1, parsedRows.length, SALES_HEADERS.length)
    .setValues(parsedRows);

  const totalSales = parsedRows.reduce((sum, row) => sum + parseNumber_(row[SALES_HEADERS.indexOf("Sale Amount")]), 0);
  const totalCommission = parsedRows.reduce((sum, row) => sum + parseNumber_(row[SALES_HEADERS.indexOf("Commission Amount")]), 0);
  getSheet_(SHEETS.uploads).appendRow([
    uploadId,
    month,
    payload && payload.name ? payload.name : "uploaded.pdf",
    parsedRows.length,
    totalSales,
    totalCommission,
    "admin",
    now,
    "Imported Document",
  ]);

  formatDatabase_();
  return getAdminState(pin);
}

function setupDatabase_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, SHEETS.sales, SALES_HEADERS);
  ensureSheet_(ss, SHEETS.uploads, UPLOAD_HEADERS);
  ensureSheet_(ss, SHEETS.settings, SETTINGS_HEADERS);
  ensureSheet_(ss, SHEETS.stockCredits, STOCK_CREDIT_HEADERS);
  ensureSheet_(ss, SHEETS.manualSales, MANUAL_SALES_HEADERS);
  ensureSheet_(ss, SHEETS.branchReportSubmissions, BRANCH_REPORT_SUBMISSION_HEADERS);
  ensureSheet_(ss, SHEETS.branchReportLines, BRANCH_REPORT_LINE_HEADERS);
  ensureDefaultSettings_();
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const existing = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
  const hasHeader = existing.some((value) => String(value || "").trim());
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const currentHeaders = existing.map((value) => String(value || "").trim());
    const missingHeaders = headers.filter((header) => currentHeaders.indexOf(header) === -1);
    if (missingHeaders.length) {
      sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  }
  return sheet;
}

function ensureDefaultSettings_() {
  const settings = getSettingsObject_();
  if (String(settings.ADMIN_PIN || "").trim() !== DEFAULT_ADMIN_PIN) {
    setSetting_("ADMIN_PIN", DEFAULT_ADMIN_PIN, "Change this in the admin page.");
  }
  if (String(settings.DATA_REPAIR_VERSION || "") !== DATA_REPAIR_VERSION) {
    repairSalesData_();
    repairManualSalesData_();
    setSetting_("DATA_REPAIR_VERSION", DATA_REPAIR_VERSION, "Last automatic sales data repair.");
  }
}

function formatDatabase_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.values(SHEETS).forEach((name) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const lastColumn = Math.max(sheet.getLastColumn(), 1);
    sheet.getRange(1, 1, 1, lastColumn)
      .setBackground("#111827")
      .setFontColor("#f9fafb")
      .setFontWeight("bold");
    sheet.autoResizeColumns(1, lastColumn);
  });
}

function repairSalesData_() {
  const sheet = getSheet_(SHEETS.sales);
  if (!sheet || sheet.getLastRow() < 2) return;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map((value) => String(value || "").trim());
  const members = getMemberRows_();
  let changed = false;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const source = {};
    headers.forEach((header, columnIndex) => {
      source[header] = values[rowIndex][columnIndex];
    });
    const normalized = normalizeSalesRow_(source, members);
    [
      "Month",
      "Employee Code",
      "Employee Name",
      "Commission Rate",
      "Commission Amount",
      "Branch",
    ].forEach((header) => {
      const columnIndex = headers.indexOf(header);
      if (columnIndex < 0) return;
      if (String(values[rowIndex][columnIndex] || "") !== String(normalized[header] || "")) {
        values[rowIndex][columnIndex] = normalized[header] || "";
        changed = true;
      }
    });
  }

  if (changed) {
    sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  }
}

function repairManualSalesData_() {
  const sheet = getSheet_(SHEETS.manualSales);
  if (!sheet || sheet.getLastRow() < 2) return;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map((value) => String(value || "").trim());
  const branchIndex = headers.indexOf("Branch");
  const saleAmountIndex = headers.indexOf("Sale Amount");
  const rateIndex = headers.indexOf("Commission Rate");
  const amountIndex = headers.indexOf("Commission Amount");
  if (branchIndex < 0 || saleAmountIndex < 0 || rateIndex < 0 || amountIndex < 0) return;

  let changed = false;
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const branch = normalizeBranch_(values[rowIndex][branchIndex]);
    const rate = getCommissionRateForBranch_(branch) || DEFAULT_COMMISSION_RATE;
    const saleAmount = parseNumber_(values[rowIndex][saleAmountIndex]);
    const commissionAmount = roundMoney_(saleAmount * rate / 100);
    if (Number(values[rowIndex][rateIndex]) !== rate) {
      values[rowIndex][rateIndex] = rate;
      changed = true;
    }
    if (Number(values[rowIndex][amountIndex]) !== commissionAmount) {
      values[rowIndex][amountIndex] = commissionAmount;
      changed = true;
    }
  }

  if (changed) {
    sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  }
}

function getSheet_(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function getSettingsObject_() {
  const sheet = getSheet_(SHEETS.settings);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return rows.reduce((acc, row) => {
    const key = String(row[0] || "").trim();
    if (key) acc[key] = row[1];
    return acc;
  }, {});
}

function setSetting_(key, value, notes) {
  const sheet = getSheet_(SHEETS.settings);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map((row) => String(row[0] || "").trim());
    const index = keys.indexOf(key);
    if (index >= 0) {
      sheet.getRange(index + 2, 2, 1, 2).setValues([[value, notes || ""]]);
      return;
    }
  }
  sheet.appendRow([key, value, notes || ""]);
}

function validateAdminPin_(pin) {
  const expected = String(getSettingsObject_().ADMIN_PIN || DEFAULT_ADMIN_PIN);
  if (String(pin || "").trim() !== expected) {
    throw new Error("Invalid admin PIN.");
  }
}

function validateBranchReportPin_(branchCode, pin) {
  const branch = normalizeBranch_(branchCode);
  if (["TG", "CG", "NNT"].indexOf(branch) < 0) {
    throw new Error("This branch cannot submit reports.");
  }
  const expected = BRANCH_REPORT_PINS[branch];
  if (String(pin || "").trim() !== expected) {
    throw new Error("Invalid branch PIN.");
  }
  return branch;
}

function getBranchReportId_(branch, cycle) {
  return ["REPORT", branch, cycle.start, cycle.end].join("-");
}

function getBranchInventorySummaryForReport_(branchCode) {
  const branch = normalizeBranch_(branchCode);
  const summary = getBranchSummaryFromRows_(readSalesRows_(), readStockCredits_(), readManualSales_())
    .find((item) => item.code === branch);
  return summary && summary.inventorySummary ? summary.inventorySummary : getEmptyInventorySummary_();
}

function getSpecialTgInventorySummaryForMember_(memberCode) {
  const normalizedCode = normalizeMemberKey_(memberCode);
  const isSpecial = SPECIAL_TG_INVENTORY_MEMBER_CODES
    .map(normalizeMemberKey_)
    .indexOf(normalizedCode) >= 0;
  const empty = {
    isSpecial,
    branch: "TG",
    totalSales: 0,
    totalCommission: 0,
    rowCount: 0,
    soldTotal: getStockSoldTotals_(getEmptyProductTotals_()),
  };
  if (!isSpecial) return empty;

  const inventory = getBranchInventorySummaryForReport_("TG");
  const cycleRows = inventory.cycleHistory || [];
  const totals = cycleRows.reduce((acc, row) => {
    acc.totalSales += parseNumber_(row.totalSales);
    acc.totalCommission += parseNumber_(row.totalCommission);
    acc.rowCount += parseNumber_(row.rowCount);
    STOCK_ITEM_KEYS_().forEach((itemKey) => {
      acc.soldTotal[itemKey] += parseNumber_(row.soldTotal && row.soldTotal[itemKey]);
    });
    return acc;
  }, empty);
  if (!cycleRows.length) {
    totals.totalSales = parseNumber_(inventory.totalSales);
    totals.totalCommission = parseNumber_(inventory.totalCommission);
    totals.soldTotal = inventory.allocationSoldTotal || inventory.soldTotal || totals.soldTotal;
  }
  return totals;
}

function getBranchReportMonths_(branchCode) {
  const now = new Date();
  const year = Number(Utilities.formatDate(now, "Asia/Bangkok", "yyyy"));
  const openCycleMonth = getCommissionCycle_().month;
  const openMonthNumber = Number(String(openCycleMonth || "").split("-")[1] || 0);
  const lastClosedMonth = Math.max(0, openMonthNumber - 1);
  const months = [];
  for (let month = 1; month <= lastClosedMonth; month += 1) {
    const key = year + "-" + String(month).padStart(2, "0");
    const cycle = getReportCycleForMonth_(key);
    const submission = getLatestBranchReportSubmission_(branchCode, cycle);
    const fallbackApproved = submission.status ? false : readBranchReportEntries_(branchCode, cycle).length > 0;
    const status = submission.status || (fallbackApproved ? "APPROVED" : "");
    months.push(Object.assign({
      key,
      submitted: status === "PENDING" || status === "APPROVED",
      status,
    }, cycle));
  }
  return months;
}

function getLatestBranchReportSubmission_(branchCode, cycle) {
  const branch = normalizeBranch_(branchCode);
  const reportId = getBranchReportId_(branch, cycle);
  const rows = readObjects_(getSheet_(SHEETS.branchReportSubmissions))
    .filter((row) => String(row["Report ID"] || "").trim() === reportId)
    .sort((a, b) => String(b["Submitted At"] || "").localeCompare(String(a["Submitted At"] || "")));
  if (!rows.length) return {};
  const row = rows[0];
  return {
    submissionId: String(row["Submission ID"] || "").trim(),
    reportId: String(row["Report ID"] || "").trim(),
    branch: normalizeBranch_(row.Branch),
    month: String(row.Month || "").trim(),
    cycleStart: normalizeDateValue_(row["Cycle Start"]) || String(row["Cycle Start"] || ""),
    cycleEnd: normalizeDateValue_(row["Cycle End"]) || String(row["Cycle End"] || ""),
    status: String(row.Status || "").trim().toUpperCase(),
    submittedAt: normalizeDateTimeValue_(row["Submitted At"]),
    notes: String(row.Notes || ""),
  };
}

function findBranchReportSubmissionById_(submissionId) {
  const id = String(submissionId || "").trim();
  if (!id) return {};
  const row = readObjects_(getSheet_(SHEETS.branchReportSubmissions))
    .find((item) => String(item["Submission ID"] || "").trim() === id);
  if (!row) return {};
  return {
    submissionId: String(row["Submission ID"] || "").trim(),
    reportId: String(row["Report ID"] || "").trim(),
    branch: normalizeBranch_(row.Branch),
    month: String(row.Month || "").trim(),
    cycleStart: normalizeDateValue_(row["Cycle Start"]) || String(row["Cycle Start"] || ""),
    cycleEnd: normalizeDateValue_(row["Cycle End"]) || String(row["Cycle End"] || ""),
    status: String(row.Status || "").trim().toUpperCase(),
    submittedAt: normalizeDateTimeValue_(row["Submitted At"]),
  };
}

function updateBranchReportSubmissionStatus_(submissionId, status, reviewer, notes) {
  const sheet = getSheet_(SHEETS.branchReportSubmissions);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((value) => String(value || "").trim());
  const idIndex = headers.indexOf("Submission ID");
  const statusIndex = headers.indexOf("Status");
  const reviewedAtIndex = headers.indexOf("Reviewed At");
  const reviewedByIndex = headers.indexOf("Reviewed By");
  const notesIndex = headers.indexOf("Notes");
  if (idIndex < 0 || statusIndex < 0) throw new Error("Missing report submission columns.");
  if (sheet.getLastRow() < 2) throw new Error("Report submission not found.");
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][idIndex] || "").trim() === String(submissionId || "").trim()) {
      const rowNumber = index + 2;
      sheet.getRange(rowNumber, statusIndex + 1).setValue(status);
      if (reviewedAtIndex >= 0) sheet.getRange(rowNumber, reviewedAtIndex + 1).setValue(new Date());
      if (reviewedByIndex >= 0) sheet.getRange(rowNumber, reviewedByIndex + 1).setValue(reviewer || "admin");
      if (notesIndex >= 0) sheet.getRange(rowNumber, notesIndex + 1).setValue(notes || "");
      return;
    }
  }
  throw new Error("Report submission not found.");
}

function createSalesRowsFromBranchReport_(submission, lines) {
  const rate = getCommissionRateForBranch_(submission.branch) || DEFAULT_COMMISSION_RATE;
  const approvedAt = new Date();
  const rows = [];
  (lines || []).forEach((line) => {
    [
      { itemKey: "boxGold", count: parseNumber_(line.boxGold), item: "NEXORA Gold Box (กล่องโกลด์)", price: STOCK_BOX_PRICES.boxGold },
      { itemKey: "boxSilver", count: parseNumber_(line.boxSilver), item: "NEXORA Silver Box (กล่องซิลเวอร์)", price: STOCK_BOX_PRICES.boxSilver },
      { itemKey: "boxBronze", count: parseNumber_(line.boxBronze), item: "NEXORA Bronze Box (กล่องบรอนซ์)", price: STOCK_BOX_PRICES.boxBronze },
    ].forEach((box) => {
      for (let boxIndex = 1; boxIndex <= box.count; boxIndex += 1) {
        const saleAmount = roundMoney_(box.price);
        rows.push([
          submission.reportId + "-" + line.employeeCode + "-" + box.itemKey + "-" + boxIndex,
          submission.reportId,
          submission.month,
          approvedAt,
          line.employeeCode,
          line.employeeName,
          "-",
          line.employeeName,
          box.item,
          1,
          saleAmount,
          rate,
          roundMoney_(saleAmount * rate / 100),
          rows.length + 1,
          ["Approved branch report " + submission.branch + " " + submission.cycleStart + " to " + submission.cycleEnd, line.notes].filter(Boolean).join(" | "),
          approvedAt,
          submission.branch,
          "",
          "",
          "",
          "",
          box.itemKey === "boxBronze" ? 1 : 0,
          box.itemKey === "boxSilver" ? 1 : 0,
          box.itemKey === "boxGold" ? 1 : 0,
          0,
          0,
          0,
          0,
          0,
          0,
        ]);
      }
    });
  });
  return rows;
}

function readBranchReportLines_(submissionId) {
  const id = String(submissionId || "").trim();
  if (!id) return [];
  return readObjects_(getSheet_(SHEETS.branchReportLines))
    .filter((row) => String(row["Submission ID"] || "").trim() === id)
    .map((row) => {
      const branch = normalizeBranch_(row.Branch);
      const employeeCode = String(row["Employee Code"] || "").trim();
      const employeeName = String(row["Employee Name"] || "").trim();
      return {
        submissionId: id,
        branch,
        month: String(row.Month || "").trim(),
        employeeCode,
        employeeName,
        nickname: getBranchReportNickname_(branch, employeeCode, employeeName),
        boxBronze: parseNumber_(row["Box Bronze"]),
        boxSilver: parseNumber_(row["Box Silver"]),
        boxGold: parseNumber_(row["Box Gold"]),
        notes: String(row.Notes || "").trim(),
      };
    });
}

function getBranchReportNickname_(branchCode, employeeCode, employeeName) {
  const branch = normalizeBranch_(branchCode);
  const code = String(employeeCode || "").trim();
  const fixed = (FIXED_BRANCH_REPORT_EMPLOYEES[branch] || []).find((employee) => {
    return normalizeMemberKey_(employee.employeeCode) === normalizeMemberKey_(code);
  });
  if (fixed && fixed.nickname) return fixed.nickname;
  const member = findMemberByCode_(code);
  return member.nickname || String(employeeName || code || "").trim();
}

function getPendingBranchReports_() {
  return readObjects_(getSheet_(SHEETS.branchReportSubmissions))
    .filter((row) => String(row.Status || "").trim().toUpperCase() === "PENDING")
    .map((row) => {
      const submissionId = String(row["Submission ID"] || "").trim();
      const lines = readBranchReportLines_(submissionId);
      const totals = getReportLineTotals_(lines);
      return {
        submissionId,
        reportId: String(row["Report ID"] || "").trim(),
        branch: normalizeBranch_(row.Branch),
        month: String(row.Month || "").trim(),
        cycleStart: normalizeDateValue_(row["Cycle Start"]) || String(row["Cycle Start"] || ""),
        cycleEnd: normalizeDateValue_(row["Cycle End"]) || String(row["Cycle End"] || ""),
        status: "PENDING",
        submittedAt: normalizeDateTimeValue_(row["Submitted At"]),
        lines,
        totals,
      };
    })
    .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
}

function getReportLineTotals_(lines) {
  return (lines || []).reduce((acc, line) => {
    acc.boxBronze += parseNumber_(line.boxBronze);
    acc.boxSilver += parseNumber_(line.boxSilver);
    acc.boxGold += parseNumber_(line.boxGold);
    acc.totalBoxes += parseNumber_(line.boxBronze) + parseNumber_(line.boxSilver) + parseNumber_(line.boxGold);
    acc.totalSales += parseNumber_(line.boxBronze) * STOCK_BOX_PRICES.boxBronze + parseNumber_(line.boxSilver) * STOCK_BOX_PRICES.boxSilver + parseNumber_(line.boxGold) * STOCK_BOX_PRICES.boxGold;
    return acc;
  }, { boxBronze: 0, boxSilver: 0, boxGold: 0, totalBoxes: 0, totalSales: 0 });
}

function validateBranchReportAgainstStock_(branch, entries) {
  const requested = (entries || []).reduce((acc, entry) => {
    acc.boxBronze += parseNumber_(entry.bronze);
    acc.boxSilver += parseNumber_(entry.silver);
    acc.boxGold += parseNumber_(entry.gold);
    return acc;
  }, { boxBronze: 0, boxSilver: 0, boxGold: 0 });
  const branchSummary = getBranchSummaryFromRows_(readSalesRows_(), readStockCredits_(), readManualSales_())
    .find((item) => item.code === branch) || {};
  const inventory = branchSummary.inventorySummary || getEmptyInventorySummary_();
  const remaining = inventory.remainingTotal || {};
  const over = STOCK_ITEM_KEYS_().some((itemKey) => requested[itemKey] > parseNumber_(remaining[itemKey]));
  if (over) {
    throw new Error("STOCK_OVER_LIMIT:" + branch);
  }
}

function getReportCycleForMonth_(monthKey) {
  const now = new Date();
  let text = String(monthKey || "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) {
    text = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM");
  }
  const parts = text.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const end = new Date(year, month - 1, 25);
  const start = new Date(year, month - 2, 25);
  return {
    month: text,
    start: Utilities.formatDate(start, "Asia/Bangkok", "yyyy-MM-dd"),
    end: Utilities.formatDate(end, "Asia/Bangkok", "yyyy-MM-dd"),
  };
}

function readBranchReportEntries_(branchCode, cycle) {
  const branch = normalizeBranch_(branchCode);
  const reportId = getBranchReportId_(branch, cycle);
  const byEmployee = {};
  readObjects_(getSheet_(SHEETS.sales))
    .filter((row) => String(row["Upload ID"] || "").trim() === reportId)
    .forEach((row) => {
      const employeeCode = String(row["Employee Code"] || "").trim();
      if (!employeeCode) return;
      if (!byEmployee[employeeCode]) {
        byEmployee[employeeCode] = {
          employeeCode,
          employeeName: String(row["Employee Name"] || "").trim(),
          boxBronze: 0,
          boxSilver: 0,
          boxGold: 0,
          saleAmount: 0,
          commissionAmount: 0,
          notes: String(row.Notes || "").replace(/^Branch report [^|]+(\s\|\s)?/, "").trim(),
        };
      }
      byEmployee[employeeCode].boxBronze += parseNumber_(row["Box Bronze"]);
      byEmployee[employeeCode].boxSilver += parseNumber_(row["Box Silver"]);
      byEmployee[employeeCode].boxGold += parseNumber_(row["Box Gold"]);
      byEmployee[employeeCode].saleAmount += parseNumber_(row["Sale Amount"]);
      byEmployee[employeeCode].commissionAmount += parseNumber_(row["Commission Amount"]);
    });
  return Object.values(byEmployee);
}

function getCommissionRate_() {
  return DEFAULT_COMMISSION_RATE;
}

function getCommissionRateForBranch_(branchCode) {
  const branch = normalizeBranch_(branchCode);
  return BRANCH_COMMISSION_RATES[branch] || 0;
}

function getCommissionRule_(text) {
  const normalizedText = normalizePersonName_(text);
  const matched = SPECIAL_COMMISSION_RULES.find((rule) => {
    const codeMatched = (rule.codes || []).some((code) => normalizeMemberKey_(text).indexOf(normalizeMemberKey_(code)) >= 0);
    const nameMatched = rule.names.some((name) => normalizedText.indexOf(normalizePersonName_(name)) >= 0);
    return codeMatched || nameMatched;
  });
  return matched || { rate: DEFAULT_COMMISSION_RATE, branch: "" };
}

function normalizePersonName_(value) {
  let text = String(value || "").toLowerCase();
  ["นาย", "นางสาว", "น.ส.", "นส.", "คุณ"].forEach((prefix) => {
    text = text.split(prefix).join("");
  });
  return text.replace(/[^\u0E00-\u0E7Fa-z0-9]/g, "").trim();
}

function readObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((value) => String(value || "").trim());
  return values
    .filter((row) => row.some((value) => String(value || "").trim() !== ""))
    .map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = header === "Month"
          ? (normalizeMonth_(row[index]) || formatValueForClient_(row[index]))
          : DATE_TIME_HEADERS_.indexOf(header) >= 0
            ? normalizeDateTimeValue_(row[index])
          : formatValueForClient_(row[index]);
      });
      return object;
    });
}

function deleteRowsByHeaderValue_(sheet, headerName, targetValue) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const headers = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0]
    .map((value) => String(value || "").trim());
  const columnIndex = headers.indexOf(headerName);
  if (columnIndex < 0) {
    throw new Error("Missing column: " + headerName);
  }

  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, columnIndex + 1, lastRow - 1, 1).getValues();
  let deleted = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][0] || "").trim() === targetValue) {
      sheet.deleteRow(index + 2);
      deleted += 1;
    }
  }
  return deleted;
}

function readSalesRows_(members) {
  const memberRows = members || getMemberRows_();
  return readObjects_(getSheet_(SHEETS.sales)).map((row) => normalizeSalesRow_(row, memberRows));
}

function readStockCredits_() {
  return readObjects_(getSheet_(SHEETS.stockCredits)).map((row) => {
    const itemKey = normalizeStockItemKey_(row["Item Key"] || row.Item);
    return {
      creditId: String(row["Credit ID"] || "").trim(),
      branch: normalizeBranch_(row.Branch),
      itemKey,
      item: getStockItemLabel_(itemKey),
      quantity: parseNumber_(row.Quantity),
      creditDate: normalizeDateValue_(row["Credit Date"]) || String(row["Credit Date"] || ""),
      createdAt: normalizeDateTimeValue_(row["Created At"]),
    };
  }).filter((row) => row.branch && row.itemKey && row.quantity > 0);
}

function readManualSales_() {
  return readObjects_(getSheet_(SHEETS.manualSales)).map((row) => {
    const itemKey = normalizeStockItemKey_(row["Item Key"] || row.Item);
    const quantity = parseNumber_(row.Quantity);
    const unitPrice = parseNumber_(row["Unit Price"]) || STOCK_BOX_PRICES[itemKey] || 0;
    const saleAmount = parseNumber_(row["Sale Amount"]) || quantity * unitPrice;
    const branch = normalizeBranch_(row.Branch);
    const commissionRate = getCommissionRateForBranch_(branch) || DEFAULT_COMMISSION_RATE;
    return {
      manualId: String(row["Manual ID"] || "").trim(),
      branch,
      itemKey,
      item: getStockItemLabel_(itemKey),
      quantity,
      unitPrice,
      saleAmount,
      commissionRate,
      commissionAmount: saleAmount * commissionRate / 100,
      clearedAt: normalizeDateTimeValue_(row["Cleared At"]),
    };
  }).filter((row) => row.branch && row.itemKey && row.quantity > 0);
}

function normalizeSalesRow_(row, members) {
  const matchedMember = findMemberForSaleRow_(row, members);
  const output = Object.assign({}, row);
  if (matchedMember.memberCode) {
    output["Employee Code"] = matchedMember.memberCode;
    output["Employee Name"] = matchedMember.realName || output["Employee Name"] || matchedMember.displayName || "";
    if (!output.Customer) output.Customer = matchedMember.displayName || matchedMember.realName || "";
  }

  output.Month = normalizeMonth_(output.Month) || output.Month;
  output["Sale Date"] = normalizeDateTimeValue_(output["Sale Date"]);

  const rule = getCommissionRule_([
    output["Employee Name"],
    output["Employee Code"],
    output.Customer,
    matchedMember.realName,
    matchedMember.nickname,
  ].join(" "));
  output.Branch = rule.branch || normalizeBranch_(matchedMember.branch || output.Branch) || output.Branch;
  const branchRate = getCommissionRateForBranch_(output.Branch);
  const rate = branchRate || rule.rate;
  output["Commission Rate"] = rate;
  output["Commission Amount"] = roundMoney_(parseNumber_(output["Sale Amount"]) * rate / 100);
  return output;
}

function findMemberForSaleRow_(row, members) {
  const keys = [
    row["Employee Code"],
    row["Employee Name"],
    row.Customer,
  ].map(normalizeMemberKey_).filter(Boolean);
  return members.find((member) => {
    return keys.some((key) => member.searchKeys && member.searchKeys.indexOf(key) >= 0);
  }) || {};
}

function sortSalesNewestFirst_(a, b) {
  const monthCompare = String(b.Month || "").localeCompare(String(a.Month || ""));
  if (monthCompare !== 0) return monthCompare;
  const dateCompare = String(b["Sale Date"] || "").localeCompare(String(a["Sale Date"] || ""));
  if (dateCompare !== 0) return dateCompare;
  return parseNumber_(a["Source Row"]) - parseNumber_(b["Source Row"]);
}

function getMonths_() {
  return getMonthsFromRows_(readObjects_(getSheet_(SHEETS.sales)));
}

function getMonthsFromRows_(sales) {
  const months = {};
  sales.forEach((row) => {
    const month = normalizeMonth_(row.Month);
    if (month) months[month] = true;
  });
  return Object.keys(months).sort().reverse();
}

function getBranchSummary_() {
  return getBranchSummaryFromRows_(readSalesRows_(), readStockCredits_(), readManualSales_());
}

function getBranchSummaryFromRows_(rows, stockCredits, manualSales) {
  const summary = {};
  BRANCHES.forEach((branch) => {
    summary[branch.code] = {
      code: branch.code,
      name: branch.name,
      employeeCount: 0,
      rowCount: 0,
      totalSales: 0,
      totalCommission: 0,
      productTotals: getEmptyProductTotals_(),
      cycleProductTotals: getEmptyProductTotals_(),
      manualProductTotals: getEmptyProductTotals_(),
      cycleManualProductTotals: getEmptyProductTotals_(),
      cycleHistory: {},
      cycleSales: 0,
      cycleCommission: 0,
      manualSales: 0,
      manualCommission: 0,
      cycleManualSales: 0,
      cycleManualCommission: 0,
      inventorySummary: getEmptyInventorySummary_(),
      employees: {},
    };
  });

  rows.forEach((row) => {
    const branchCode = normalizeBranch_(row.Branch) || "GENERAL";
    if (!summary[branchCode]) {
      summary[branchCode] = {
        code: branchCode,
        name: branchCode,
        employeeCount: 0,
        rowCount: 0,
        totalSales: 0,
        totalCommission: 0,
        productTotals: getEmptyProductTotals_(),
        cycleProductTotals: getEmptyProductTotals_(),
        manualProductTotals: getEmptyProductTotals_(),
        cycleManualProductTotals: getEmptyProductTotals_(),
        cycleHistory: {},
        cycleSales: 0,
        cycleCommission: 0,
        manualSales: 0,
        manualCommission: 0,
        cycleManualSales: 0,
        cycleManualCommission: 0,
        inventorySummary: getEmptyInventorySummary_(),
        employees: {},
      };
    }

    const branch = summary[branchCode];
    const employeeCode = String(row["Employee Code"] || "").trim() || "UNKNOWN";
    if (!branch.employees[employeeCode]) {
      const reportNickname = getBranchReportNickname_(branchCode, employeeCode, row["Employee Name"]);
      branch.employees[employeeCode] = {
        employeeCode,
        employeeName: row["Employee Name"] || "",
        nickname: reportNickname && reportNickname !== row["Employee Name"] ? reportNickname : "",
        totalSales: 0,
        totalCommission: 0,
        rowCount: 0,
        cycleHistory: {},
      };
    }

    const saleAmount = parseNumber_(row["Sale Amount"]);
    const commissionAmount = parseNumber_(row["Commission Amount"]);
    const saleCycle = getSalesRowCommissionCycle_(row);
    const isCurrentCycleSale = saleCycle && saleCycle.month === getCommissionCycle_().month;
    branch.rowCount += 1;
    branch.totalSales += saleAmount;
    branch.totalCommission += commissionAmount;
    addProductTotals_(branch.productTotals, row);
    if (isCurrentCycleSale) {
      branch.cycleSales += saleAmount;
      branch.cycleCommission += commissionAmount;
      addProductTotals_(branch.cycleProductTotals, row);
    }
    addInventoryCycleSale_(branch, saleCycle, row, saleAmount, commissionAmount, false);
    branch.employees[employeeCode].totalSales += saleAmount;
    branch.employees[employeeCode].totalCommission += commissionAmount;
    branch.employees[employeeCode].rowCount += 1;
    addEmployeeCycleTotals_(branch.employees[employeeCode], saleCycle, saleAmount, commissionAmount);
  });

  (manualSales || []).forEach((row) => {
    const branchCode = normalizeBranch_(row.branch) || "GENERAL";
    if (!summary[branchCode]) return;
    const branch = summary[branchCode];
    const isCurrentCycleManual = isDateInCommissionCycle_(row.clearedAt, getCommissionCycle_());
    const manualCycle = getCommissionCycleForDate_(row.clearedAt);
    const shouldShowInBranchCard = branchCode === "TG";
    if (shouldShowInBranchCard) {
      branch.rowCount += 1;
      branch.totalSales += parseNumber_(row.saleAmount);
      branch.totalCommission += parseNumber_(row.commissionAmount);
      branch.productTotals[row.itemKey] += parseNumber_(row.quantity);
      if (isCurrentCycleManual) {
        branch.cycleSales += parseNumber_(row.saleAmount);
        branch.cycleCommission += parseNumber_(row.commissionAmount);
        branch.cycleProductTotals[row.itemKey] += parseNumber_(row.quantity);
      }
    }
    branch.manualSales += parseNumber_(row.saleAmount);
    branch.manualCommission += parseNumber_(row.commissionAmount);
    branch.manualProductTotals[row.itemKey] += parseNumber_(row.quantity);
    if (isCurrentCycleManual) {
      branch.cycleManualSales += parseNumber_(row.saleAmount);
      branch.cycleManualCommission += parseNumber_(row.commissionAmount);
      branch.cycleManualProductTotals[row.itemKey] += parseNumber_(row.quantity);
    }
    addInventoryCycleManualSale_(branch, manualCycle, row);
  });

  Object.keys(FIXED_BRANCH_REPORT_EMPLOYEES).forEach((branchCode) => {
    if (!summary[branchCode]) return;
    FIXED_BRANCH_REPORT_EMPLOYEES[branchCode].forEach((employee) => {
      if (!summary[branchCode].employees[employee.employeeCode]) {
        summary[branchCode].employees[employee.employeeCode] = {
          employeeCode: employee.employeeCode,
          employeeName: employee.employeeName || employee.nickname || employee.employeeCode,
          nickname: employee.nickname || "",
          totalSales: 0,
          totalCommission: 0,
          rowCount: 0,
          cycleHistory: {},
        };
      }
    });
  });

  const inventoryByBranch = getInventorySummaryByBranch_(stockCredits || [], summary);

  return Object.values(summary).map((branch) => {
    const employees = Object.values(branch.employees).map((employee) => {
      return Object.assign({}, employee, {
        cycleHistory: Object.values(employee.cycleHistory || {}).sort((a, b) => String(b.month || "").localeCompare(String(a.month || ""))),
      });
    }).sort((a, b) => b.totalSales - a.totalSales);
    return {
      code: branch.code,
      name: branch.name,
      employeeCount: employees.length,
      rowCount: branch.rowCount,
      totalSales: branch.totalSales,
      totalCommission: branch.totalCommission,
      productTotals: branch.productTotals,
      cycleHistory: buildBranchSummaryCycleHistory_(branch.code, branch),
      inventorySummary: inventoryByBranch[branch.code] || getEmptyInventorySummary_(),
      employees,
    };
  });
}

function findMemberByCode_(memberCode) {
  const code = String(memberCode || "").trim();
  if (!code) return {};

  const rows = getMemberRows_();
  return findMemberInRows_(code, rows);
}

function findMemberInRows_(memberCode, rows) {
  const normalizedCode = normalizeMemberKey_(memberCode);
  return (rows || []).find((member) => {
    return member.searchKeys && member.searchKeys.indexOf(normalizedCode) >= 0;
  }) || {};
}

function getMemberRows_() {
  const ss = SpreadsheetApp.openById(MEMBER_SPREADSHEET_ID);
  const members = [];
  ss.getSheets().forEach((sheet) => {
    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 2) return;

      const layout = detectMemberHeaderLayout_(values) || inferMemberLayout_(values);
      if (!layout) return;

    values.slice(layout.headerRowIndex + 1).forEach((row) => {
      const memberCode = String(getCell_(row, layout.indexes.memberCode) || "").trim();
      if (!memberCode) return;
      const realName = String(getCell_(row, layout.indexes.realName) || "").trim();
      const nickname = String(getCell_(row, layout.indexes.nickname) || "").trim();
      const bgImage = normalizeMemberImageUrl_(String(getCell_(row, layout.indexes.bgImage) || "").trim());
      const branch = normalizeBranch_(String(getCell_(row, layout.indexes.branch) || "").trim());
      const searchKeys = buildMemberSearchKeys_(row, layout.indexes, { memberCode, realName, nickname });

      members.push({
        memberCode,
        realName,
        nickname,
        displayName: [realName, nickname ? "(" + nickname + ")" : ""].filter(Boolean).join(" "),
        bgImage,
        branch,
        searchKeys,
      });
    });
  });
  return members;
}

function getBranchReportEmployees_(branchCode) {
  const branch = normalizeBranch_(branchCode);
  if (FIXED_BRANCH_REPORT_EMPLOYEES[branch]) {
    return FIXED_BRANCH_REPORT_EMPLOYEES[branch].map((employee) => Object.assign({}, employee));
  }
  const byCode = {};
  getMemberRows_().forEach((member) => {
    const memberBranch = normalizeBranch_(member.branch);
    const specialRule = getCommissionRule_([member.memberCode, member.realName, member.nickname].join(" "));
    const finalBranch = specialRule.branch || memberBranch;
    if (finalBranch !== branch) return;
    byCode[member.memberCode] = {
      employeeCode: member.memberCode,
      employeeName: member.realName || member.displayName || member.memberCode,
      nickname: member.nickname || "",
    };
  });
  return Object.values(byCode).sort((a, b) => {
    return String(a.employeeCode || "").localeCompare(String(b.employeeCode || ""));
  });
}

function detectMemberHeaderLayout_(values) {
  let best = null;
  values.slice(0, 12).forEach((row, rowIndex) => {
    const normalized = row.map(normalizeHeader_);
      const indexes = {
      memberCode: findHeader_(normalized, ["รหัสสมาชิก", "member code", "member id", "member no", "member_no", "user code", "user_code", "customer tag", "code", "id", "รหัสประจำตัว", "รหัส"]),
      realName: findHeader_(normalized, ["ชื่อจริง", "ชื่อ-สกุล", "ชื่อสกุล", "fullname", "full name", "real name", "name", "ชื่อ"]),
      nickname: findHeader_(normalized, ["ชื่อเล่น", "nickname", "nick name", "nick"]),
      bgImage: findHeader_(normalized, ["bg_image", "bg image", "background", "image", "รูป", "ภาพ"]),
      branch: findHeader_(normalized, ["สาขา", "branch"]),
    };
    const score = [
      indexes.memberCode,
      indexes.realName,
      indexes.nickname,
      indexes.bgImage,
      indexes.branch,
    ].filter((index) => index !== "").length;
    if (indexes.memberCode !== "" && (!best || score > best.score)) {
      best = { headerRowIndex: rowIndex, indexes, score };
    }
  });
  return best;
}

function inferMemberLayout_(values) {
  if (!values || values.length < 2) return null;
  const sampleRows = values.slice(1, Math.min(values.length, 80));
  const maxColumns = Math.max(...values.slice(0, Math.min(values.length, 20)).map((row) => row.length));
  let bestColumn = "";
  let bestScore = 0;

  for (let column = 0; column < maxColumns; column += 1) {
    const score = sampleRows.reduce((sum, row) => {
      return sum + (looksLikeMemberCode_(row[column]) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }

  if (bestColumn === "") return null;
  const normalized = (values[0] || []).map(normalizeHeader_);
  return {
    headerRowIndex: 0,
    indexes: {
      memberCode: bestColumn,
      realName: findHeader_(normalized, ["ชื่อจริง", "ชื่อ-สกุล", "ชื่อสกุล", "fullname", "full name", "real name", "name", "ชื่อ"]),
      nickname: findHeader_(normalized, ["ชื่อเล่น", "nickname", "nick name", "nick"]),
      bgImage: findHeader_(normalized, ["bg_image", "bg image", "background", "image", "รูป", "ภาพ"]),
      branch: findHeader_(normalized, ["สาขา", "branch"]),
    },
    score: bestScore,
  };
}

function getMemberMatchKeys_(inputCode, member) {
  const keys = [
    inputCode,
    member.memberCode,
    member.realName,
    member.nickname,
    member.displayName,
    ...(member.searchKeys || []),
  ]
    .map(normalizeMemberKey_)
    .filter(Boolean);
  return [...new Set(keys)];
}

function normalizeMemberKey_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function buildMemberSearchKeys_(row, indexes, member) {
  const keys = [
    member.memberCode,
    member.realName,
    member.nickname,
  ];

  Object.keys(indexes || {}).forEach((key) => {
    const index = indexes[key];
    if (isSelectedColumn_(index)) {
      keys.push(row[Number(index)]);
    }
  });

  row.forEach((value) => {
    const text = String(value || "").trim();
    if (looksLikeMemberCode_(text)) {
      keys.push(text);
    }
  });

  return [...new Set(keys.map(normalizeMemberKey_).filter(Boolean))];
}

function looksLikeMemberCode_(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/@/.test(text)) return false;
  if (/^0\d{8,10}$/.test(text.replace(/[-\s]/g, ""))) return false;
  if (/^\d{13}$/.test(text.replace(/\D/g, ""))) return false;
  return /[A-Za-z]/.test(text) && /\d/.test(text) && text.length <= 24;
}

function normalizeMemberImageUrl_(url) {
  const text = String(url || "").trim();
  if (!text) return "";
  const driveId =
    (text.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] ||
    (text.match(/[?&]id=([a-zA-Z0-9_-]+)/) || [])[1];
  if (driveId) {
    return "https://drive.google.com/thumbnail?id=" + driveId + "&sz=w1600";
  }
  return text;
}

function isPosDocumentReport_(headers) {
  const normalized = headers.map(normalizeHeader_);
  return findHeader_(normalized, ["bill no"]) !== "" &&
    findHeader_(normalized, ["product code"]) !== "" &&
    findHeader_(normalized, ["customers name"]) !== "";
}

function expandPosDocumentRows_(rows, headers) {
  const normalized = headers.map(normalizeHeader_);
  const indexes = {
    createDate: findHeader_(normalized, ["create date"]),
    billNo: findHeader_(normalized, ["bill no"]),
    paymentMethod: findHeader_(normalized, ["payment method"]),
    staffName: findHeader_(normalized, ["staff name"]),
    customerName: findHeader_(normalized, ["customers name", "customer name"]),
    customerTag: findHeader_(normalized, ["customers tag", "customer tag"]),
    productCode: findHeader_(normalized, ["product code"]),
    productName: findHeader_(normalized, ["product name"]),
    productCategory: findHeader_(normalized, ["product category"]),
    priceUnit: findHeader_(normalized, ["price/unit"]),
    quantity: findHeader_(normalized, ["quantity"]),
    lineTotal: findHeader_(normalized, ["total"]),
    billTotal: findHeader_(normalized, ["total amount"]),
    billNote: findHeader_(normalized, ["bill note"]),
    productNotes: findHeader_(normalized, ["product notes"]),
  };
  const context = {};
  const expanded = [];

  rows.forEach((sourceRow) => {
    if (getCell_(sourceRow, indexes.billNo)) {
      context.createDate = getCell_(sourceRow, indexes.createDate);
      context.billNo = getCell_(sourceRow, indexes.billNo);
      context.paymentMethod = getCell_(sourceRow, indexes.paymentMethod);
      context.staffName = getCell_(sourceRow, indexes.staffName);
      context.customerName = getCell_(sourceRow, indexes.customerName);
      context.customerTag = getCell_(sourceRow, indexes.customerTag);
      context.billTotal = getCell_(sourceRow, indexes.billTotal);
      context.billNote = getCell_(sourceRow, indexes.billNote);
    }

    const productCode = getCell_(sourceRow, indexes.productCode);
    const productName = getCell_(sourceRow, indexes.productName);
    const quantity = parseNumber_(getCell_(sourceRow, indexes.quantity));
    const lineTotal = parseNumber_(getCell_(sourceRow, indexes.lineTotal));
    if (!productCode && !productName) {
      return;
    }
    if (quantity <= 0 && lineTotal <= 0) {
      return;
    }

    const output = new Array(headers.length).fill("");
    setCell_(output, indexes.createDate, context.createDate);
    setCell_(output, indexes.billNo, context.billNo);
    setCell_(output, indexes.paymentMethod, context.paymentMethod);
    setCell_(output, indexes.staffName, context.staffName);
    setCell_(output, indexes.customerName, context.customerName);
    setCell_(output, indexes.customerTag, context.customerTag);
    setCell_(output, indexes.billTotal, context.billTotal);
    setCell_(output, indexes.billNote, context.billNote);
    setCell_(output, indexes.productCode, productCode);
    setCell_(output, indexes.productName, productName);
    setCell_(output, indexes.productCategory, getCell_(sourceRow, indexes.productCategory));
    setCell_(output, indexes.priceUnit, getCell_(sourceRow, indexes.priceUnit));
    setCell_(output, indexes.quantity, quantity);
    setCell_(output, indexes.lineTotal, lineTotal);
    setCell_(output, indexes.productNotes, getCell_(sourceRow, indexes.productNotes));
    expanded.push(output);
  });

  return expanded;
}

function detectHeaderLayout_(values) {
  let bestIndex = 0;
  let bestScore = -1;
  values.forEach((row, index) => {
    const text = normalizeHeader_(row.join(" "));
    let score = 0;
    ["รหัสสมาชิก", "รหัสพนักงาน", "sale", "ยอดขาย", "ค่าคอม", "ธนาคาร", "เลขบัญชี"].forEach((needle) => {
      if (text.indexOf(normalizeHeader_(needle)) >= 0) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const top = values[bestIndex] || [];
  const sub = values[bestIndex + 1] || [];
  const hasSubHeader = sub.some((value) => {
    const text = normalizeHeader_(value);
    return ["bronze", "silver", "glod", "gold", "ไข่เงิน", "ไข่ทอง"].some((needle) => text.indexOf(normalizeHeader_(needle)) >= 0);
  });

  let lastTop = "";
  const columnCount = Math.max(top.length, sub.length);
  const headers = [];
  for (let index = 0; index < columnCount; index += 1) {
    const topText = String(top[index] || "").trim();
    const subText = String(hasSubHeader ? sub[index] || "" : "").trim();
    if (topText) lastTop = topText;
    let header = topText || "";
    if (!header && subText && lastTop) header = lastTop + " " + subText;
    if (header && subText && header !== subText) header = header + " " + subText;
    headers.push(header || "Column " + (index + 1));
  }

  return {
    headers,
    headerRowIndex: bestIndex,
    dataStartIndex: bestIndex + (hasSubHeader ? 2 : 1),
  };
}

function convertExcelPayload_(payload) {
  if (!payload || !payload.data) {
    throw new Error("No upload data received.");
  }

  const name = payload.name || "commission-upload.xlsx";
  const contentType = payload.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const base64 = String(payload.data).split(",").pop();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), contentType, name);
  const resource = {
    title: "tmp-commission-" + Date.now() + "-" + name,
    mimeType: MimeType.GOOGLE_SHEETS,
  };
  const file = Drive.Files.insert(resource, blob, { convert: true });
  return {
    fileId: file.id,
    spreadsheet: SpreadsheetApp.openById(file.id),
  };
}

function isDocumentPayload_(payload) {
  const name = String(payload && payload.name || "").toLowerCase();
  const mimeType = String(payload && payload.mimeType || "").toLowerCase();
  return mimeType.indexOf("pdf") >= 0 ||
    mimeType.indexOf("word") >= 0 ||
    mimeType.indexOf("msword") >= 0 ||
    /\.(pdf|doc|docx)$/i.test(name);
}

function extractUploadDocumentData_(payload) {
  if (!payload || !payload.data) {
    throw new Error("No upload data received.");
  }

  const name = payload.name || "commission-upload";
  const base64 = String(payload.data).split(",").pop();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), getUploadMimeType_(payload), name);
  const resource = {
    title: "tmp-commission-doc-" + Date.now() + "-" + name,
  };
  const file = insertDocumentUpload_(resource, blob, payload);

  try {
    const doc = DocumentApp.openById(file.id);
    const body = doc.getBody();
    const tables = body.getTables().map((table) => {
      const rows = [];
      for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
        const tableRow = table.getRow(rowIndex);
        const cells = [];
        for (let cellIndex = 0; cellIndex < tableRow.getNumCells(); cellIndex += 1) {
          cells.push(cleanPdfText_(tableRow.getCell(cellIndex).getText()));
        }
        rows.push(cells);
      }
      return rows;
    });
    return {
      text: cleanPdfText_(body.getText()),
      tables,
    };
  } finally {
    cleanupConvertedFile_(file.id);
  }
}

function insertDocumentUpload_(resource, blob, payload) {
  const options = { convert: true };
  if (isPdfPayload_(payload)) {
    options.ocr = true;
    options.ocrLanguage = "th";
  }

  try {
    return Drive.Files.insert(resource, blob, options);
  } catch (error) {
    if (!isPdfPayload_(payload) || !isOcrUnsupportedError_(error)) {
      throw error;
    }
    return Drive.Files.insert(resource, blob, { convert: true });
  }
}

function isOcrUnsupportedError_(error) {
  const message = String(error && (error.message || error) || "");
  return /ocr/i.test(message) && /not supported|unsupported|files\.insert/i.test(message);
}

function isPdfPayload_(payload) {
  const name = String(payload && payload.name || "").toLowerCase();
  const mimeType = String(payload && payload.mimeType || "").toLowerCase();
  return mimeType.indexOf("pdf") >= 0 || /\.pdf$/i.test(name);
}

function getUploadMimeType_(payload) {
  const mimeType = String(payload && payload.mimeType || "").trim();
  const name = String(payload && payload.name || "").toLowerCase();
  if (mimeType) return mimeType;
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.docx$/i.test(name)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (/\.doc$/i.test(name)) return "application/msword";
  return "application/octet-stream";
}

function parseNntPdfRows_(pdfData, context) {
  const rows = [];
  const seen = {};
  (pdfData.tables || []).forEach((table) => {
    table.forEach((cells, rowIndex) => {
      const parsed = parseNntPdfCells_(cells, context, rowIndex + 1);
      if (parsed && !seen[parsed.key]) {
        seen[parsed.key] = true;
        rows.push(parsed.row);
      }
    });
  });

  cleanPdfText_(pdfData.text || "").split(/\n+/).forEach((line, index) => {
    const parsed = parseNntPdfLine_(line, context, index + 1);
    if (parsed && !seen[parsed.key]) {
      seen[parsed.key] = true;
      rows.push(parsed.row);
    }
  });

  return rows;
}

function parseNntPdfCells_(cells, context, sourceRow) {
  const cleanCells = (cells || []).map(cleanPdfText_).filter(Boolean);
  if (cleanCells.length < 2) return null;
  const rowText = cleanCells.join(" ");
  if (isNntPdfHeaderOrTotal_(rowText)) return null;

  let amount = 0;
  let amountIndex = -1;
  cleanCells.forEach((cell, index) => {
    const value = parseLikelySaleAmount_(cell);
    if (value > amount) {
      amount = value;
      amountIndex = index;
    }
  });
  if (amount <= 0) return null;

  const code = findLikelyMemberCode_(rowText);
  const name = cleanCells.find((cell, index) => {
    return index !== amountIndex &&
      cell !== code &&
      /[A-Za-zก-๙]/.test(cell) &&
      !looksLikeHeaderText_(cell) &&
      parseLikelySaleAmount_(cell) <= 0;
  }) || code || "NNT";

  return buildNntPdfSaleRow_({
    code: code || name,
    name,
    item: guessNntPdfItem_(rowText),
    saleAmount: amount,
    saleDate: findDateInText_(rowText) || context.month + "-01",
    notes: "NNT PDF row: " + rowText,
    sourceRow,
  }, context);
}

function parseNntPdfLine_(line, context, sourceRow) {
  const text = cleanPdfText_(line);
  if (!text || isNntPdfHeaderOrTotal_(text)) return null;

  const amount = parseLikelySaleAmount_(text);
  if (amount <= 0) return null;

  const code = findLikelyMemberCode_(text);
  const nameText = text
    .replace(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g, " ")
    .replace(code || "", " ")
    .replace(/\s+/g, " ")
    .trim();
  const name = extractLikelyName_(nameText) || code;
  if (!code && !name) return null;

  return buildNntPdfSaleRow_({
    code: code || name,
    name: name || code,
    item: guessNntPdfItem_(text),
    saleAmount: amount,
    saleDate: findDateInText_(text) || context.month + "-01",
    notes: "NNT PDF line: " + text,
    sourceRow,
  }, context);
}

function buildNntPdfSaleRow_(entry, context) {
  const saleAmount = parseNumber_(entry.saleAmount);
  if (saleAmount <= 0) return null;
  const matchedMember = [
    entry.code,
    entry.name,
    entry.notes,
  ].map((key) => findMemberInRows_(key, context.members || [])).find((member) => member.memberCode) || {};
  const employeeCode = String(matchedMember.memberCode || entry.code || entry.name || "NNT").trim();
  const employeeName = matchedMember.realName || entry.name || employeeCode;
  const rule = getCommissionRule_([employeeName, employeeCode, entry.notes, matchedMember.nickname].join(" "));
  const productBreakdown = getProductBreakdown_(entry.item || entry.notes, 1);
  const branch = rule.branch || normalizeBranch_(matchedMember.branch || context.uploadBranch) || "NNT";
  const rate = getCommissionRateForBranch_(branch) || rule.rate;
  const commissionAmount = roundMoney_(saleAmount * rate / 100);
  const saleId = [
    context.uploadId,
    entry.sourceRow,
    employeeCode,
    Utilities.getUuid().slice(0, 8),
  ].join("-");
  const row = [
    saleId,
    context.uploadId,
    context.month,
    normalizeDateValue_(entry.saleDate) || context.month + "-01",
    employeeCode,
    employeeName,
    "NNT-PDF-" + entry.sourceRow,
    "",
    entry.item || "NNT PDF Summary",
    "",
    saleAmount,
    rate,
    commissionAmount,
    entry.sourceRow,
    entry.notes || "",
    context.now,
    branch,
    "",
    "",
    "",
    "",
    productBreakdown.boxBronze || "",
    productBreakdown.boxSilver || "",
    productBreakdown.boxGold || "",
    productBreakdown.packBronze || "",
    productBreakdown.packSilver || "",
    productBreakdown.packGold || "",
    productBreakdown.silverEgg || "",
    productBreakdown.goldEgg || "",
    productBreakdown.otherQty || "",
  ];
  return {
    key: [employeeCode, saleAmount, entry.sourceRow].join("|"),
    row,
  };
}

function cleanPdfText_(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isNntPdfHeaderOrTotal_(text) {
  const normalized = normalizeHeader_(text);
  if (!normalized) return true;
  if (normalized.indexOf("รวมทั้งหมด") >= 0 || normalized.indexOf("grand total") >= 0) return true;
  if (normalized.indexOf("total") >= 0 && findLikelyMemberCode_(text) === "") return true;
  return looksLikeHeaderText_(text) && parseLikelySaleAmount_(text) <= 0;
}

function looksLikeHeaderText_(text) {
  const normalized = normalizeHeader_(text);
  return ["รายงาน", "ยอดขาย", "รหัส", "ชื่อ", "จำนวน", "สินค้า", "ราคา", "บาท", "sale", "code", "name", "amount"].some((needle) => {
    return normalized.indexOf(normalizeHeader_(needle)) >= 0;
  });
}

function parseLikelySaleAmount_(text) {
  const matches = String(text || "").match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g) || [];
  let best = 0;
  matches.forEach((match) => {
    const value = parseNumber_(match);
    if (value <= 0) return;
    if (value >= 2400 && value <= 2600 && !/[,.]/.test(match)) return;
    if (value > best) best = value;
  });
  return best;
}

function findLikelyMemberCode_(text) {
  const tokens = String(text || "").match(/[A-Za-z][A-Za-z0-9-]{1,24}|[A-Za-z]-[A-Za-z0-9-]{1,24}|N-[A-Za-z0-9-]{1,24}/g) || [];
  const found = tokens.find((token) => looksLikeMemberCode_(token));
  return found ? String(found).trim() : "";
}

function extractLikelyName_(text) {
  const cleaned = cleanPdfText_(text)
    .replace(/\b(NEXORA|Gold|Silver|Bronze|Box|Pack|NNT|PDF|Summary)\b/gi, " ")
    .replace(/[|:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || looksLikeHeaderText_(cleaned)) return "";
  return cleaned;
}

function guessNntPdfItem_(text) {
  const normalized = normalizeHeader_(text);
  if (normalized.indexOf("gold") >= 0 || normalized.indexOf("โกล") >= 0) return "NNT PDF Gold";
  if (normalized.indexOf("silver") >= 0 || normalized.indexOf("ซิล") >= 0) return "NNT PDF Silver";
  if (normalized.indexOf("bronze") >= 0 || normalized.indexOf("บรอน") >= 0) return "NNT PDF Bronze";
  return "NNT PDF Summary";
}

function findDateInText_(text) {
  const match = String(text || "").match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (!match) return "";
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (year > 2400) year -= 543;
  const month = String(Number(match[2])).padStart(2, "0");
  const day = String(Number(match[1])).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function cleanupConvertedFile_(fileId) {
  try {
    Drive.Files.trash(fileId);
  } catch (error) {
    console.warn(error);
  }
}

function guessMapping_(headers) {
  const normalized = headers.map(normalizeHeader_);
  const mapping = {
    branch: findHeader_(normalized, ["branch", "สาขา"]),
    saleDate: findHeader_(normalized, ["date", "day", "วันที่", "วันขาย"]),
    employeeCode: findHeader_(normalized, ["employee code", "member code", "customers tag", "customer tag", "รหัส", "รหัสพนักงาน", "รหัสสมาชิก"]),
    employeeName: findHeader_(normalized, ["employee name", "customers name", "customer name", "seller", "staff", "ชื่อ", "พนักงาน"]),
    phone: findHeader_(normalized, ["phone", "tel", "เบอร์", "โทร"]),
    bank: findHeader_(normalized, ["bank", "ธนาคาร"]),
    accountNo: findHeader_(normalized, ["account no", "เลขบัญชี", "บัญชี"]),
    accountName: findHeader_(normalized, ["account name", "ชื่อบัญชี"]),
    invoiceNo: findHeader_(normalized, ["invoice", "bill", "order", "เลขบิล", "บิล"]),
    customer: findHeader_(normalized, ["customer", "ลูกค้า"]),
    item: findHeader_(normalized, ["product name", "item", "product", "สินค้า", "รายการ"]),
    productCode: findHeader_(normalized, ["product code"]),
    quantity: findHeader_(normalized, ["qty", "quantity", "จำนวน"]),
    saleAmount: findHeader_(normalized, ["total amount", "amount", "sale", "total", "ยอดขาย", "ยอด", "รวม"]),
    notes: findHeader_(normalized, ["note", "remark", "หมายเหตุ"]),
    boxBronze: findHeader_(normalized, ["box bronze", "กล่อง bronze", "bronze"]),
    boxSilver: findHeader_(normalized, ["box silver", "กล่อง silver", "silver"]),
    boxGold: findHeader_(normalized, ["box gold", "กล่อง gold", "glod"]),
    packBronze: findHeader_(normalized, ["pack bronze", "ซอง bronze"]),
    packSilver: findHeader_(normalized, ["pack silver", "ซอง silver"]),
    packGold: findHeader_(normalized, ["pack gold", "ซอง gold", "ซอง glod"]),
    silverEgg: findHeader_(normalized, ["silver egg", "ไข่เงิน"]),
    goldEgg: findHeader_(normalized, ["gold egg", "ไข่ทอง"]),
    otherQty: findHeader_(normalized, ["other", "อื่น"]),
  };
  if (isPosDocumentReport_(headers)) {
    mapping.saleDate = findHeader_(normalized, ["create date"]);
    mapping.employeeCode = findHeader_(normalized, ["customers tag"]);
    mapping.employeeName = findHeader_(normalized, ["customers name"]);
    mapping.invoiceNo = findHeader_(normalized, ["bill no"]);
    mapping.customer = findHeader_(normalized, ["customers name"]);
    mapping.item = findHeader_(normalized, ["product name"]);
    mapping.productCode = findHeader_(normalized, ["product code"]);
    mapping.quantity = findHeader_(normalized, ["quantity"]);
    mapping.saleAmount = findHeader_(normalized, ["total"]);
    mapping.notes = findHeader_(normalized, ["bill note"]);
  }
  return mapping;
}

function findHeader_(normalizedHeaders, candidates) {
  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    for (let c = 0; c < candidates.length; c += 1) {
      if (normalizedHeaders[i].indexOf(normalizeHeader_(candidates[c])) >= 0) {
        return i;
      }
    }
  }
  return "";
}

function normalizeHeader_(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeBranch_(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  if (text.indexOf("NEX") >= 0) return "NEX";
  if (text === "TG" || text.indexOf(" TG") >= 0) return "TG";
  if (text === "CG" || text.indexOf(" CG") >= 0) return "CG";
  if (text.indexOf("NNT") >= 0) return "NNT";
  if (text.indexOf("เครือ") >= 0 || text.indexOf("GENERAL") >= 0 || text.indexOf("ทั่วไป") >= 0) return "GENERAL";
  return text;
}

function getEmptyProductTotals_() {
  return {
    boxBronze: 0,
    boxSilver: 0,
    boxGold: 0,
    packBronze: 0,
    packSilver: 0,
    packGold: 0,
    silverEgg: 0,
    goldEgg: 0,
    otherQty: 0,
  };
}

function getEmptyInventorySummary_() {
  return {
    totalSales: 0,
    totalCommission: 0,
    cycleStart: "",
    cycleEnd: "",
    creditsTotal: {
      boxBronze: 0,
      boxSilver: 0,
      boxGold: 0,
    },
    creditsAllTotal: {
      boxBronze: 0,
      boxSilver: 0,
      boxGold: 0,
    },
    soldTotal: {
      boxBronze: 0,
      boxSilver: 0,
      boxGold: 0,
    },
    remainingTotal: {
      boxBronze: 0,
      boxSilver: 0,
      boxGold: 0,
    },
    oversoldTotal: {
      boxBronze: 0,
      boxSilver: 0,
      boxGold: 0,
    },
    cycleHistory: [],
    lots: [],
  };
}

function getInventorySummaryByBranch_(stockCredits, branchSummary) {
  const result = {};
  const cycle = getCommissionCycle_();
  Object.keys(branchSummary || {}).forEach((branchCode) => {
    const branch = branchSummary[branchCode] || {};
    const isTgInventory = branchCode === "TG";
    const cycleRows = buildInventoryCycleHistory_(branchCode, branch);
    const currentCycle = cycleRows.find((row) => row.month === cycle.month) || buildEmptyInventoryCycleRow_(cycle.month, cycle.start, cycle.end);
    const allocationSoldTotal = cycleRows.reduce((totals, row) => {
      STOCK_ITEM_KEYS_().forEach((itemKey) => {
        totals[itemKey] += parseNumber_(row.soldTotal && row.soldTotal[itemKey]);
      });
      return totals;
    }, getStockSoldTotals_(getEmptyProductTotals_()));
    result[branchCode] = getEmptyInventorySummary_();
    result[branchCode].cycleStart = cycle.start;
    result[branchCode].cycleEnd = cycle.end;
    result[branchCode].cycleMonth = cycle.month;
    result[branchCode].cycleHistory = cycleRows;
    result[branchCode].soldTotal = currentCycle.soldTotal || getStockSoldTotals_(getEmptyProductTotals_());
    result[branchCode].allocationSoldTotal = allocationSoldTotal;
    result[branchCode].totalSales = currentCycle.totalSales || 0;
    result[branchCode].totalCommission = currentCycle.totalCommission || 0;
  });

  stockCredits.forEach((credit) => {
    if (!result[credit.branch]) {
      result[credit.branch] = getEmptyInventorySummary_();
      result[credit.branch].cycleStart = cycle.start;
      result[credit.branch].cycleEnd = cycle.end;
      result[credit.branch].cycleMonth = cycle.month;
    }
    result[credit.branch].creditsAllTotal[credit.itemKey] += credit.quantity;
    const creditCycle = getCommissionCycleForDate_(credit.creditDate);
    const creditCycleRow = ensureInventorySummaryCycleRow_(result[credit.branch], creditCycle);
    if (creditCycleRow) {
      creditCycleRow.creditsTotal[credit.itemKey] += credit.quantity;
    }
    if (isDateInCommissionCycle_(credit.creditDate, cycle)) {
      result[credit.branch].creditsTotal[credit.itemKey] += credit.quantity;
    }
  });

  Object.keys(result).forEach((branchCode) => {
    const summary = result[branchCode];
    summary.lots = allocateStockLots_(stockCredits.filter((credit) => credit.branch === branchCode), summary.allocationSoldTotal || summary.soldTotal);
    STOCK_ITEM_KEYS_().forEach((itemKey) => {
      const lots = summary.lots.filter((lot) => lot.itemKey === itemKey);
      summary.remainingTotal[itemKey] = lots.reduce((sum, lot) => sum + Math.max(lot.remaining || 0, 0), 0);
      summary.oversoldTotal[itemKey] = lots.reduce((sum, lot) => sum + Math.max(-(lot.remaining || 0), 0), 0);
    });
  });

  return result;
}

function mergeProductTotals_(primary, secondary) {
  const totals = getEmptyProductTotals_();
  Object.keys(totals).forEach((key) => {
    totals[key] = parseNumber_(primary && primary[key]) + parseNumber_(secondary && secondary[key]);
  });
  return totals;
}

function addInventoryCycleSale_(branch, cycle, row, saleAmount, commissionAmount, isManual) {
  if (!cycle || !cycle.month) return;
  const entry = ensureInventoryCycleEntry_(branch, cycle);
  if (isManual) {
    entry.manualSales += parseNumber_(saleAmount);
    entry.manualCommission += parseNumber_(commissionAmount);
    entry.manualRowCount += 1;
    addProductTotals_(entry.manualProductTotals, row);
  } else {
    entry.sales += parseNumber_(saleAmount);
    entry.commission += parseNumber_(commissionAmount);
    entry.rowCount += 1;
    addProductTotals_(entry.productTotals, row);
  }
}

function addInventoryCycleManualSale_(branch, cycle, row) {
  if (!cycle || !cycle.month) return;
  const entry = ensureInventoryCycleEntry_(branch, cycle);
  const itemKey = normalizeStockItemKey_(row.itemKey || row.Item);
  entry.manualSales += parseNumber_(row.saleAmount);
  entry.manualCommission += parseNumber_(row.commissionAmount);
  entry.manualRowCount += 1;
  if (itemKey) {
    entry.manualProductTotals[itemKey] += parseNumber_(row.quantity);
  }
}

function ensureInventoryCycleEntry_(branch, cycle) {
  branch.cycleHistory = branch.cycleHistory || {};
  if (!branch.cycleHistory[cycle.month]) {
    branch.cycleHistory[cycle.month] = {
      month: cycle.month,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      sales: 0,
      commission: 0,
      rowCount: 0,
      manualSales: 0,
      manualCommission: 0,
      manualRowCount: 0,
      productTotals: getEmptyProductTotals_(),
      manualProductTotals: getEmptyProductTotals_(),
    };
  }
  return branch.cycleHistory[cycle.month];
}

function addEmployeeCycleTotals_(employee, cycle, saleAmount, commissionAmount) {
  if (!employee || !cycle || !cycle.month) return;
  employee.cycleHistory = employee.cycleHistory || {};
  if (!employee.cycleHistory[cycle.month]) {
    employee.cycleHistory[cycle.month] = {
      month: cycle.month,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      rowCount: 0,
      totalSales: 0,
      totalCommission: 0,
    };
  }
  employee.cycleHistory[cycle.month].rowCount += 1;
  employee.cycleHistory[cycle.month].totalSales += parseNumber_(saleAmount);
  employee.cycleHistory[cycle.month].totalCommission += parseNumber_(commissionAmount);
}

function buildBranchSummaryCycleHistory_(branchCode, branch) {
  const includeManual = branchCode === "TG";
  return Object.values(branch.cycleHistory || {}).map((entry) => {
    return {
      month: entry.month,
      cycleStart: entry.cycleStart,
      cycleEnd: entry.cycleEnd,
      rowCount: parseNumber_(entry.rowCount) + (includeManual ? parseNumber_(entry.manualRowCount) : 0),
      totalSales: parseNumber_(entry.sales) + (includeManual ? parseNumber_(entry.manualSales) : 0),
      totalCommission: parseNumber_(entry.commission) + (includeManual ? parseNumber_(entry.manualCommission) : 0),
    };
  }).sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
}

function buildInventoryCycleHistory_(branchCode, branch) {
  const isTgInventory = branchCode === "TG";
  return Object.values(branch.cycleHistory || {}).map((entry) => {
    const hasReportedSales = parseNumber_(entry.rowCount) > 0;
    const productTotals = isTgInventory
      ? entry.manualProductTotals || {}
      : hasReportedSales
        ? entry.productTotals || {}
        : mergeProductTotals_(entry.productTotals || {}, entry.manualProductTotals || {});
    const soldTotal = getStockSoldTotals_(productTotals);
    return {
      month: entry.month,
      cycleStart: entry.cycleStart,
      cycleEnd: entry.cycleEnd,
      rowCount: isTgInventory
        ? parseNumber_(entry.manualRowCount)
        : hasReportedSales
          ? parseNumber_(entry.rowCount)
          : parseNumber_(entry.rowCount) + parseNumber_(entry.manualRowCount),
      totalSales: isTgInventory
        ? parseNumber_(entry.manualSales)
        : hasReportedSales
          ? parseNumber_(entry.sales)
          : parseNumber_(entry.sales) + parseNumber_(entry.manualSales),
      totalCommission: isTgInventory
        ? parseNumber_(entry.manualCommission)
        : hasReportedSales
          ? parseNumber_(entry.commission)
          : parseNumber_(entry.commission) + parseNumber_(entry.manualCommission),
      creditsTotal: {
        boxBronze: 0,
        boxSilver: 0,
        boxGold: 0,
      },
      soldTotal,
      totalBoxes: STOCK_ITEM_KEYS_().reduce((sum, key) => sum + parseNumber_(soldTotal[key]), 0),
    };
  }).sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
}

function buildEmptyInventoryCycleRow_(month, start, end) {
  return {
    month,
    cycleStart: start,
    cycleEnd: end,
    totalSales: 0,
    totalCommission: 0,
    rowCount: 0,
    creditsTotal: {
      boxBronze: 0,
      boxSilver: 0,
      boxGold: 0,
    },
    soldTotal: getStockSoldTotals_(getEmptyProductTotals_()),
    totalBoxes: 0,
  };
}

function ensureInventorySummaryCycleRow_(summary, cycle) {
  if (!summary || !cycle || !cycle.month) return null;
  summary.cycleHistory = summary.cycleHistory || [];
  let row = summary.cycleHistory.find((item) => item.month === cycle.month);
  if (!row) {
    row = buildEmptyInventoryCycleRow_(cycle.month, cycle.start, cycle.end);
    summary.cycleHistory.push(row);
    summary.cycleHistory.sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
  }
  if (!row.creditsTotal) {
    row.creditsTotal = {
      boxBronze: 0,
      boxSilver: 0,
      boxGold: 0,
    };
  }
  return row;
}

function getCommissionCycle_() {
  const now = new Date();
  const year = Number(Utilities.formatDate(now, "Asia/Bangkok", "yyyy"));
  const month = Number(Utilities.formatDate(now, "Asia/Bangkok", "MM"));
  const day = Number(Utilities.formatDate(now, "Asia/Bangkok", "dd"));
  const startMonth = day >= 25 ? month : month - 1;
  const start = new Date(year, startMonth - 1, 25);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 25);
  return {
    month: Utilities.formatDate(end, "Asia/Bangkok", "yyyy-MM"),
    start: Utilities.formatDate(start, "Asia/Bangkok", "yyyy-MM-dd"),
    end: Utilities.formatDate(end, "Asia/Bangkok", "yyyy-MM-dd"),
  };
}

function getCommissionCycleForDate_(value) {
  const normalized = normalizeDateValue_(value);
  if (!normalized) return null;
  const datePart = String(normalized).slice(0, 10);
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;
  let year = Number(parts[0]);
  let month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;
  if (day >= 25) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return getReportCycleForMonth_(year + "-" + String(month).padStart(2, "0"));
}

function getSalesRowCommissionCycle_(row) {
  const uploadId = String(row && row["Upload ID"] || "").trim();
  const month = normalizeMonth_(row && row.Month);
  if (uploadId.indexOf("REPORT-") === 0 && month) {
    return getReportCycleForMonth_(month);
  }
  return getCommissionCycleForDate_(row && row["Sale Date"]);
}

function isDateInCommissionCycle_(value, cycle) {
  const date = normalizeDateValue_(value);
  if (!date) return false;
  return date >= cycle.start && date < cycle.end;
}

function allocateStockLots_(credits, soldTotal) {
  const lots = [];
  STOCK_ITEM_KEYS_().forEach((itemKey) => {
    let soldLeft = soldTotal[itemKey] || 0;
    credits
      .filter((credit) => credit.itemKey === itemKey)
      .sort((a, b) => {
        const dateCompare = String(a.creditDate || "").localeCompare(String(b.creditDate || ""));
        if (dateCompare !== 0) return dateCompare;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      })
      .forEach((credit) => {
        const sold = Math.min(credit.quantity, soldLeft);
        soldLeft -= sold;
        const remaining = Math.max(credit.quantity - sold, 0);
        lots.push({
          creditId: credit.creditId,
          itemKey,
          item: getStockItemLabel_(itemKey),
          creditDate: credit.creditDate,
          quantity: credit.quantity,
          sold,
          remaining,
          status: remaining <= 0 ? "ขายหมดแล้ว" : sold > 0 ? "กำลังขายล็อตนี้" : "รอขาย",
        });
      });
    if (soldLeft > 0) {
      lots.push({
        creditId: "OVER-" + itemKey,
        itemKey,
        item: getStockItemLabel_(itemKey),
        creditDate: "",
        quantity: 0,
        sold: soldLeft,
        remaining: -soldLeft,
        status: "ขายเกินเครดิตที่บันทึก",
      });
    }
  });
  return lots;
}

function getStockSoldTotals_(productTotals) {
  return {
    boxBronze: parseNumber_(productTotals.boxBronze),
    boxSilver: parseNumber_(productTotals.boxSilver),
    boxGold: parseNumber_(productTotals.boxGold),
  };
}

function STOCK_ITEM_KEYS_() {
  return ["boxBronze", "boxSilver", "boxGold"];
}

function normalizeStockItemKey_(value) {
  const key = String(value || "").trim();
  if (STOCK_ITEM_KEYS_().indexOf(key) >= 0) return key;
  const text = normalizeHeader_(key);
  if (text.indexOf("bronze") >= 0 || text.indexOf("บรอนซ์") >= 0) return "boxBronze";
  if (text.indexOf("silver") >= 0 || text.indexOf("ซิลเวอร์") >= 0) return "boxSilver";
  if (text.indexOf("gold") >= 0 || text.indexOf("โกลด์") >= 0) return "boxGold";
  return "";
}

function getStockItemLabel_(itemKey) {
  return {
    boxBronze: "กล่อง Bronze",
    boxSilver: "กล่อง Silver",
    boxGold: "กล่อง Gold",
  }[itemKey] || itemKey || "";
}

function addProductTotals_(target, row) {
  target.boxBronze += parseNumber_(row["Box Bronze"]);
  target.boxSilver += parseNumber_(row["Box Silver"]);
  target.boxGold += parseNumber_(row["Box Gold"]);
  target.packBronze += parseNumber_(row["Pack Bronze"]);
  target.packSilver += parseNumber_(row["Pack Silver"]);
  target.packGold += parseNumber_(row["Pack Gold"]);
  target.silverEgg += parseNumber_(row["Silver Egg"]);
  target.goldEgg += parseNumber_(row["Gold Egg"]);
  target.otherQty += parseNumber_(row["Other Qty"]);
}

function getProductBreakdown_(productText, quantity) {
  const text = normalizeHeader_(productText);
  const qty = parseNumber_(quantity) || 1;
  const result = getEmptyProductTotals_();

  if (text.indexOf("bronze") >= 0 || text.indexOf("บรอนซ์") >= 0) {
    if (text.indexOf("ซอง") >= 0 || text.indexOf("pack") >= 0) {
      result.packBronze = qty;
    } else {
      result.boxBronze = qty;
    }
    return result;
  }

  if (text.indexOf("silver") >= 0 || text.indexOf("ซิลเวอร์") >= 0) {
    if (text.indexOf("ซอง") >= 0 || text.indexOf("pack") >= 0) {
      result.packSilver = qty;
    } else {
      result.boxSilver = qty;
    }
    return result;
  }

  if (text.indexOf("gold") >= 0 || text.indexOf("glod") >= 0 || text.indexOf("โกลด์") >= 0) {
    if (text.indexOf("ซอง") >= 0 || text.indexOf("pack") >= 0) {
      result.packGold = qty;
    } else {
      result.boxGold = qty;
    }
    return result;
  }

  if (text.indexOf("ไข่เงิน") >= 0 || text.indexOf("silver egg") >= 0) {
    result.silverEgg = qty;
    return result;
  }

  if (text.indexOf("ไข่ทอง") >= 0 || text.indexOf("gold egg") >= 0) {
    result.goldEgg = qty;
    return result;
  }

  result.otherQty = qty;
  return result;
}

function getMappedValue_(row, columnIndex) {
  if (!isSelectedColumn_(columnIndex)) {
    return "";
  }
  return row[Number(columnIndex)];
}

function getCell_(row, columnIndex) {
  return isSelectedColumn_(columnIndex) ? row[Number(columnIndex)] : "";
}

function setCell_(row, columnIndex, value) {
  if (isSelectedColumn_(columnIndex)) {
    row[Number(columnIndex)] = value;
  }
}

function isSelectedColumn_(columnIndex) {
  return columnIndex !== "" &&
    columnIndex !== undefined &&
    columnIndex !== null &&
    isFinite(columnIndex);
}

function normalizeMonth_(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, "Asia/Bangkok", "yyyy-MM");
  }
  return "";
}

function normalizeDateValue_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  }
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  }
  return String(value);
}

function normalizeDateTimeValue_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  }
  const text = String(value || "").trim();
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s*[- ]\s*(\d{1,2}:\d{2}(?::\d{2})?))?$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    const day = String(Number(dmy[1])).padStart(2, "0");
    const month = String(Number(dmy[2])).padStart(2, "0");
    return year + "-" + month + "-" + day + (dmy[4] ? " " + normalizeTimeText_(dmy[4]) : "");
  }
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T-]+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (ymd) {
    return ymd[1] + "-" + String(Number(ymd[2])).padStart(2, "0") + "-" + String(Number(ymd[3])).padStart(2, "0") + (ymd[4] ? " " + normalizeTimeText_(ymd[4]) : "");
  }
  const date = new Date(text);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  }
  return text;
}

function normalizeTimeText_(value) {
  const parts = String(value || "").split(":");
  const hour = String(Number(parts[0] || 0)).padStart(2, "0");
  const minute = String(Number(parts[1] || 0)).padStart(2, "0");
  const second = parts.length > 2 ? ":" + String(Number(parts[2] || 0)).padStart(2, "0") : "";
  return hour + ":" + minute + second;
}

function parseNumber_(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function roundMoney_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatValueForClient_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  }
  return value;
}
