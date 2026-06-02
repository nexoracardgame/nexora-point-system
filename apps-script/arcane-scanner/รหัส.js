const SHEET_ID = "1zXG8UycndiDuehWQNfqXMvMWrnEoxuqjn_NURWSa7-0";
const SHEET_NAME = "NEXORA การ์ดแลกรางวัลทั้งหมด";

function doGet(e) {
  const page = e && e.parameter && e.parameter.page;

  if (page === "member") {
    return HtmlService
      .createHtmlOutputFromFile("index_member")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ค่าเริ่มต้น = ระบบค้นหาการ์ด
  return HtmlService
    .createHtmlOutputFromFile("index")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function normalizeCardNo(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  return digits.slice(-3).padStart(3, "0");
}

function getExactCardNoQuery(value) {
  const q = String(value || "").trim().toLowerCase();
  if (!q) return "";

  if (/^(?:no\.?|card|card\s*no|#)\s*0*[0-9]{1,3}$/.test(q)) {
    return normalizeCardNo(q);
  }

  if (/^0*[0-9]{1,3}$/.test(q)) {
    return normalizeCardNo(q);
  }

  return "";
}

function toCardResult(row, idxNo, idxName, idxReward, idxValue, idxImg) {
  return {
    card_no: row[idxNo],
    card_name: row[idxName],
    reward: row[idxReward],
    value: row[idxValue],
    image_url: idxImg >= 0 ? row[idxImg] : ""
  };
}

function searchCards(q) {
  q = (q || "").toString().trim();
  if (!q) return [];

  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sh.getDataRange().getValues();
  const header = data.shift();

  const idxNo = header.indexOf("card_no");
  const idxName = header.indexOf("card_name");
  const idxReward = header.indexOf("reward");
  const idxValue = header.indexOf("value");
  const idxImg = header.indexOf("image_url");

  const exactCardNo = getExactCardNoQuery(q);

  if (exactCardNo) {
    for (const r of data) {
      if (normalizeCardNo(r[idxNo]) === exactCardNo) {
        return [toCardResult(r, idxNo, idxName, idxReward, idxValue, idxImg)];
      }
    }
    return [];
  }

  const result = [];
  const textQuery = q.toLowerCase();
  for (const r of data) {
    const text = `${r[idxNo]} ${r[idxName]} ${r[idxReward]} ${r[idxValue]}`.toLowerCase();
    if (text.includes(textQuery)) {
      result.push(toCardResult(r, idxNo, idxName, idxReward, idxValue, idxImg));
    }
  }
  return result;
}

// ====== PAGE VIEW COUNTER ======
const COUNTER_KEY = 'NEXORA_PAGE_VIEW';

function increaseCounter() {
  const props = PropertiesService.getScriptProperties();
  const count = Number(props.getProperty(COUNTER_KEY) || 0) + 1;
  props.setProperty(COUNTER_KEY, String(count));
  return count;
}
