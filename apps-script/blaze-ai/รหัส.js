function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("NEXORA AI Chat")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ================== CONFIG ==================
const SHEET_ID = "1Ux_JZKUbhJLPNa2lLZdaBljXH-17bff9AdFzwXBcaGg";

// แชท / vision
const CHAT_MODEL_NAME = "gemini-2.5-flash";

// เจนรูป / แก้รูป
const IMAGE_MODEL_NAME = "gemini-2.5-flash-image";

const CACHE_SECONDS = 0;

// ปิดลิมิตไว้ก่อน
const RATE_LIMIT_MAX = 999999;
const RATE_LIMIT_WINDOW = 60;

// ===== LIVE / WORLD CHECK =====
const WEBSEARCH_ENABLED = false;
const LIVE_CACHE_SECONDS = 45;
const LIVE_SEARCH_MAX_RESULTS = 5;

// ===== CARD DATABASE =====
const CARD_DB_SPREADSHEET_ID = "1zXG8UycndiDuehWQNfqXMvMWrnEoxuqjn_NURWSa7-0";
const CARD_DB_SHEET_NAME = "";
const CARD_DB_MAX_RESULTS = 8;

// ===== Presence / Analytics =====
const ANALYTICS_SHEET_NAME = "ANALYTICS";
const ONLINE_ACTIVE_SECONDS = 12; // ลดให้ไวขึ้น

// ===== Zendesk Conversations API =====
const ZENDESK_SUBDOMAIN = "necshora63coltd";
const ZENDESK_APP_ID = "69bd8a8a27f5cb320fe28ea1";

// ===== Zendesk display mode =====
const ZENDESK_SPLIT_MODE = false;
const ZENDESK_MAX_LEN = 220;
const ZENDESK_SEND_DELAY_MS = 250;

// ================== UTIL ==================
function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
}

function getZendeskApiKey() {
  return PropertiesService.getScriptProperties().getProperty("ZENDESK_API_KEY");
}

function getZendeskApiSecret() {
  return PropertiesService.getScriptProperties().getProperty("ZENDESK_API_SECRET");
}

function getSerpApiKey() {
  return PropertiesService.getScriptProperties().getProperty("SERPAPI_KEY");
}

function getCache(key) {
  return CacheService.getScriptCache().get(key);
}

function setCache(key, value) {
  if (!CACHE_SECONDS || CACHE_SECONDS <= 0) return;
  CacheService.getScriptCache().put(key, value, CACHE_SECONDS);
}

function getLiveCache(key) {
  return CacheService.getScriptCache().get("live_" + key);
}

function setLiveCache(key, value, seconds) {
  CacheService.getScriptCache().put("live_" + key, value, seconds || LIVE_CACHE_SECONDS);
}

function sanitizeText(text) {
  return String(text || "").trim();
}

function hashKey(text) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    String(text || ""),
    Utilities.Charset.UTF_8
  );

  return raw.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function normalizeCardNumber(text) {
  if (!text) return "";

  let raw = String(text).toLowerCase();

  const thaiToArabic = {
    "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
    "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9"
  };

  raw = raw.replace(/[๐-๙]/g, ch => thaiToArabic[ch] || ch);
  raw = raw.replace(/[^0-9]/g, "");

  if (!raw) return "";

  raw = raw.slice(-3);
  return raw.padStart(3, "0");
}

function normalizeThaiText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeaderKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\wก-๙_]/g, "");
}

function enforceBlazeStyle(text) {
  let t = sanitizeText(text);

  t = t
    .replace(/ค่ะ|คะ|นะคะ|เจ้าค่ะ|เพคะ|พะยะค่ะ|พ่ะย่ะค่ะ|ดิฉัน|หนู/g, "")
    .replace(/\bฉัน\b/g, "ข้า")
    .replace(/\bผม\b/g, "ข้า")
    .replace(/\bกระผม\b/g, "ข้า");

  t = t.replace(/\s{2,}/g, " ").trim();

  if (!t.includes("ข้า") && !t.includes("ท่านเบลซ")) {
    t = "ข้า " + t;
  }

  return t.trim();
}

function removeImageLinksFromReply(text) {
  let t = String(text || "");
  t = t.replace(/https?:\/\/\S+\.(jpg|jpeg|png|webp|gif)/gi, "");
  t = t.replace(/\bimage_url\b.*$/gim, "");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

function checkRateLimit(userId) {
  const cache = CacheService.getScriptCache();
  const key = "rate_" + userId;
  const count = parseInt(cache.get(key) || "0", 10);

  if (count >= RATE_LIMIT_MAX) {
    throw new Error("RATE_LIMIT");
  }

  cache.put(key, String(count + 1), RATE_LIMIT_WINDOW);
}

function fetchGemini(url, options) {
  let lastError = null;

  for (let i = 0; i < 3; i++) {
    const response = UrlFetchApp.fetch(url, options);
    const raw = response.getContentText();
    let json;

    try {
      json = JSON.parse(raw);
    } catch (e) {
      lastError = "INVALID_JSON_RESPONSE";
      Utilities.sleep(800 * (i + 1));
      continue;
    }

    if (!json.error) return json;

    lastError = json.error.message || "API_FAIL";
    const lower = String(lastError).toLowerCase();

    if (
      lower.includes("api key not valid") ||
      lower.includes("permission") ||
      lower.includes("forbidden") ||
      lower.includes("unauthenticated")
    ) {
      throw new Error(lastError);
    }

    Utilities.sleep(800 * (i + 1));
  }

  throw new Error(lastError || "API_FAIL");
}

function fetchJson(url, headers) {
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: headers || {},
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const raw = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("HTTP_" + code + ": " + raw);
  }

  return JSON.parse(raw);
}

function buildGenerateContentUrl(modelName, apiKey) {
  return (
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(modelName) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey)
  );
}

function dataUrlFromInlineData(inlineData) {
  if (!inlineData || !inlineData.mimeType || !inlineData.data) return "";
  return "data:" + inlineData.mimeType + ";base64," + inlineData.data;
}

// ================== DATA ==================
function getMainSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
}

function getMemorySheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("MEMORY");
  if (!sheet) {
    sheet = ss.insertSheet("MEMORY");
    sheet.appendRow(["timestamp", "client_id", "role", "text"]);
  }
  return sheet;
}

function getAnalyticsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(ANALYTICS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(ANALYTICS_SHEET_NAME);
    sheet.appendRow([
      "session_id",
      "client_id",
      "first_seen",
      "last_seen",
      "last_action",
      "is_visible",
      "user_agent"
    ]);
  }

  return sheet;
}

function getDataFromSheet() {
  const sheet = getMainSheet();
  const data = sheet.getDataRange().getValues();

  const result = {};
  for (let i = 1; i < data.length; i++) {
    const key = sanitizeText(data[i][0]);
    const value = data[i][1];
    if (key) result[key] = value;
  }
  return result;
}

function getSheetObjectsById(spreadsheetId, sheetName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];

  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const rawHeaders = values[0];
  const headers = rawHeaders.map(h => normalizeHeaderKey(h));
  const rows = values.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

function getCardDbRows() {
  const cacheKey = "card_db_rows_v3";
  const cached = getCache(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const rows = getSheetObjectsById(
    CARD_DB_SPREADSHEET_ID,
    CARD_DB_SHEET_NAME || null
  );

  setCache(cacheKey, JSON.stringify(rows));
  return rows;
}

// ================== PRESENCE / REALTIME ==================
function getSessionRowNumber_(sheet, sessionId) {
  const cleanSessionId = sanitizeText(sessionId);
  if (!cleanSessionId) return 0;

  const cache = CacheService.getScriptCache();
  const cacheKey = "sess_row_" + cleanSessionId;
  const cached = cache.get(cacheKey);
  if (cached) return Number(cached) || 0;

  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  if (rowCount <= 0) return 0;

  const finder = sheet.getRange(2, 1, rowCount, 1)
    .createTextFinder(cleanSessionId)
    .matchEntireCell(true)
    .findNext();

  const row = finder ? finder.getRow() : 0;
  if (row > 0) {
    cache.put(cacheKey, String(row), 21600);
  }
  return row;
}

function upsertSessionPresence(sessionId, clientId, action, isVisible, userAgent) {
  const cleanSessionId = sanitizeText(sessionId);
  const cleanClientId = sanitizeText(clientId) || "unknown";
  const cleanAction = sanitizeText(action) || "online";
  const cleanUserAgent = sanitizeText(userAgent);
  const visibleValue = isVisible ? "1" : "0";

  if (!cleanSessionId) {
    throw new Error("MISSING_SESSION_ID");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getAnalyticsSheet();
    const now = new Date();
    const existingRow = getSessionRowNumber_(sheet, cleanSessionId);

    if (existingRow > 0) {
      sheet.getRange(existingRow, 4, 1, 4).setValues([[
        now,
        cleanAction,
        visibleValue,
        cleanUserAgent
      ]]);
    } else {
      sheet.appendRow([
        cleanSessionId,
        cleanClientId,
        now,
        now,
        cleanAction,
        visibleValue,
        cleanUserAgent
      ]);
      const newRow = sheet.getLastRow();
      CacheService.getScriptCache().put("sess_row_" + cleanSessionId, String(newRow), 21600);
    }

    return getRealtimeStats();
  } finally {
    lock.releaseLock();
  }
}

function getRealtimeStats() {
  const sheet = getAnalyticsSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      onlineNow: 0,
      totalSessions: 0,
      updatedAt: new Date().toISOString()
    };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const nowMs = Date.now();
  const activeWindowMs = ONLINE_ACTIVE_SECONDS * 1000;

  let onlineNow = 0;
  let totalSessions = 0;

  for (var i = 0; i < values.length; i++) {
    totalSessions++;

    const lastSeen = values[i][3];
    const isVisible = String(values[i][5] || "") === "1";
    const lastAction = String(values[i][4] || "");

    if (!lastSeen) continue;

    const seenMs = new Date(lastSeen).getTime();
    if (isNaN(seenMs)) continue;

    if (lastAction === "leave" || lastAction === "closed") {
      continue;
    }

    if ((nowMs - seenMs) <= activeWindowMs && isVisible) {
      onlineNow++;
    }
  }

  return {
    onlineNow: onlineNow,
    totalSessions: totalSessions,
    updatedAt: new Date().toISOString()
  };
}

function bootstrapPresence(sessionId, clientId, meta) {
  meta = meta || {};
  return upsertSessionPresence(
    sessionId,
    clientId,
    "open",
    !!meta.isVisible,
    meta.userAgent || ""
  );
}

function heartbeatPresence(sessionId, clientId, meta) {
  meta = meta || {};
  return upsertSessionPresence(
    sessionId,
    clientId,
    meta.action || "heartbeat",
    !!meta.isVisible,
    meta.userAgent || ""
  );
}

// ================== CARD DB SEARCH ==================
function normalizeCardRow(row) {
  function firstNonEmpty(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return String(v).trim();
      }
    }
    return "";
  }

  function findByHeaderKeywords(obj, keywordGroups) {
    const keys = Object.keys(obj || {});
    for (var g = 0; g < keywordGroups.length; g++) {
      const group = keywordGroups[g];
      for (var i = 0; i < keys.length; i++) {
        const k = String(keys[i] || "").toLowerCase().trim();
        let ok = true;
        for (var j = 0; j < group.length; j++) {
          if (!k.includes(group[j])) {
            ok = false;
            break;
          }
        }
        if (ok) {
          const val = obj[keys[i]];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            return String(val).trim();
          }
        }
      }
    }
    return "";
  }

  function extractNumberFromAnyField(obj) {
    const keys = Object.keys(obj || {});
    for (var i = 0; i < keys.length; i++) {
      const key = String(keys[i] || "").toLowerCase().trim();
      const val = String(obj[keys[i]] || "").trim();
      if (!val) continue;

      if (
        key.includes("no") ||
        key.includes("number") ||
        key.includes("เลข") ||
        key.includes("ลำดับ")
      ) {
        const n = normalizeCardNumber(val);
        if (n) return { raw: val, normalized: n };
      }
    }

    for (var j = 0; j < keys.length; j++) {
      const val2 = String(obj[keys[j]] || "").trim();
      const n2 = normalizeCardNumber(val2);
      if (n2) return { raw: val2, normalized: n2 };
    }

    return { raw: "", normalized: "" };
  }

  const cardNoDirect = firstNonEmpty([
    row.card_no, row.cardno, row.no, row["no."], row.number,
    row.card_number, row.cardnumber, row["card no"], row["card no."],
    row["เลขการ์ด"], row["หมายเลข"], row["ลำดับ"]
  ]);

  const cardNoFuzzy = findByHeaderKeywords(row, [
    ["card", "no"], ["card", "number"], ["เลข", "การ์ด"],
    ["หมายเลข"], ["ลำดับ"], ["number"], ["no"]
  ]);

  const fallbackNumber = extractNumberFromAnyField(row);

  const cardNo = firstNonEmpty([
    cardNoDirect,
    cardNoFuzzy,
    fallbackNumber.raw
  ]);

  const cardName = firstNonEmpty([
    row.card_name, row.cardname, row.name, row["card name"], row["ชื่อการ์ด"],
    findByHeaderKeywords(row, [["card", "name"], ["ชื่อ", "การ์ด"], ["name"]])
  ]);

  const reward = firstNonEmpty([
    row.reward, row["รางวัล"], row.reward_value, row.nex,
    findByHeaderKeywords(row, [["reward"], ["รางวัล"], ["nex"]])
  ]);

  const value = firstNonEmpty([
    row.value, row.rarity, row["ระดับ"], row["ประเภท"], row.tier,
    findByHeaderKeywords(row, [["rarity"], ["value"], ["ระดับ"], ["ประเภท"], ["tier"]])
  ]);

  const imageUrl = firstNonEmpty([
    row.image_url, row.image, row.img, row.url, row["รูป"], row["รูปภาพ"],
    findByHeaderKeywords(row, [["image"], ["img"], ["url"], ["รูป"]])
  ]);

  const cardNoNormalized = firstNonEmpty([
    normalizeCardNumber(cardNo),
    fallbackNumber.normalized
  ]);

  return {
    card_no: sanitizeText(cardNo),
    card_no_normalized: sanitizeText(cardNoNormalized),
    card_name: sanitizeText(cardName),
    reward: sanitizeText(reward),
    value: sanitizeText(value),
    image_url: sanitizeText(imageUrl)
  };
}

function isCardRelatedQuestion(message) {
  const text = normalizeThaiText(message);
  const hasNumber = normalizeCardNumber(message) !== "";

  const keywords = [
    "การ์ด", "card", "ใบ", "เลขการ์ด", "card no", "card_no",
    "reward", "รางวัล", "มูลค่า", "nex", "coin", "รูปการ์ด", "ภาพการ์ด",
    "bronze", "silver", "gold", "diamond", "tank",
    "บรอนซ์", "เงิน", "ทอง", "เพชร", "ถัง", "เบอร์", "เลข"
  ];

  return hasNumber || keywords.some(k => text.includes(k));
}

function searchGoogle(query) {
  const url = "https://www.google.com/search?q=" + encodeURIComponent(query) + "&hl=th";
  
  const res = UrlFetchApp.fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const html = res.getContentText();

  const results = [];
  const regex = /<a href="\/url\?q=(https:\/\/[^&]+)&/g;

  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push(match[1]);
    if (results.length >= 5) break;
  }

  return results;
}

function searchCardsFromMessage(message, limit) {
  const q = normalizeThaiText(message);
  const maxResults = limit || CARD_DB_MAX_RESULTS;
  const queryCardNumber = normalizeCardNumber(message);

  if (!q && !queryCardNumber) return [];

  const rows = getCardDbRows();
  if (!rows.length) return [];

  const tokens = q
    .split(/[\s,|/\\\-()]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const results = rows.map(raw => {
    const row = normalizeCardRow(raw);

    const cardNo = normalizeThaiText(row.card_no);
    const cardNoNormalized = sanitizeText(row.card_no_normalized);
    const cardName = normalizeThaiText(row.card_name);
    const reward = normalizeThaiText(row.reward);
    const value = normalizeThaiText(row.value);

    let score = 0;

    if (queryCardNumber) {
      if (cardNoNormalized === queryCardNumber) score += 2000;
      else if (cardNo.includes(queryCardNumber)) score += 700;
      else if (normalizeCardNumber(cardNo) === queryCardNumber) score += 1500;
    }

    if (cardName && q === cardName) score += 500;
    if (cardName && q.includes(cardName)) score += 250;
    if (cardNo && q === cardNo) score += 600;
    if (cardNo && q.includes(cardNo)) score += 300;

    tokens.forEach(token => {
      if (!token) return;
      if (cardNo.includes(token)) score += 40;
      if (cardName.includes(token)) score += 35;
      if (value.includes(token)) score += 15;
      if (reward.includes(token)) score += 12;
    });

    if (q.includes("gold") && value.includes("gold")) score += 30;
    if (q.includes("silver") && value.includes("silver")) score += 30;
    if (q.includes("bronze") && value.includes("bronze")) score += 30;
    if (q.includes("diamond") && value.includes("diamond")) score += 30;
    if (q.includes("tank") && value.includes("tank")) score += 30;

    if (q.includes("ทอง") && value.includes("gold")) score += 30;
    if (q.includes("เงิน") && value.includes("silver")) score += 30;
    if (q.includes("บรอนซ์") && value.includes("bronze")) score += 30;
    if (q.includes("เพชร") && value.includes("diamond")) score += 30;
    if (q.includes("ถัง") && value.includes("tank")) score += 30;

    return {
      card_no: row.card_no,
      card_no_normalized: row.card_no_normalized,
      card_name: row.card_name,
      reward: row.reward,
      value: row.value,
      image_url: row.image_url,
      score: score
    };
  });

  return results
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

function buildCardDatabaseContext(message) {
  const matchedCards = searchCardsFromMessage(message, CARD_DB_MAX_RESULTS);

  if (!matchedCards.length) {
    return "ฐานข้อมูลการ์ดที่เกี่ยวข้อง: ไม่พบการ์ดที่ตรงชัดเจนจากคำถามนี้";
  }

  let text = "ฐานข้อมูลการ์ดที่เกี่ยวข้องจากชีทการ์ดจริง:\n";

  matchedCards.forEach((card, index) => {
    text +=
      (index + 1) + ") " +
      "เลขการ์ด: " + (card.card_no || "-") +
      " | ชื่อการ์ด: " + (card.card_name || "-") +
      " | ระดับ: " + (card.value || "-") +
      " | รางวัล/มูลค่า: " + (card.reward || "-") +
      "\n";
  });

  text +=
    "\nกฎสำคัญของฐานข้อมูลการ์ด:\n" +
    "- ถ้ามีข้อมูลจากฐานการ์ดนี้ ให้ยึดข้อมูลนี้ก่อน\n" +
    "- ห้ามเดาชื่อการ์ดหรือรางวัลเพิ่มเอง\n" +
    "- ถ้าพบหลายใบใกล้เคียง ให้สรุปเป็นตัวเลือกก่อน\n" +
    "- ห้ามพูดถึงลิงก์รูปหรือ image_url เด็ดขาด\n";

  return text;
}

// ================== MEMORY ==================
function saveMemory(clientId, role, text) {
  const cleanClientId = sanitizeText(clientId);
  const cleanRole = sanitizeText(role);
  const cleanText = sanitizeText(text);

  if (!cleanClientId || !cleanRole || !cleanText) return;

  const sheet = getMemorySheet();
  sheet.appendRow([new Date(), cleanClientId, cleanRole, cleanText]);
}

function getRecentMemory(clientId, limit) {
  const cleanClientId = sanitizeText(clientId);
  if (!cleanClientId) return [];

  const sheet = getMemorySheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const filtered = [];

  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][1]) === cleanClientId) {
      filtered.push({
        timestamp: data[i][0],
        client_id: data[i][1],
        role: data[i][2],
        text: data[i][3]
      });
      if (filtered.length >= limit) break;
    }
  }

  return filtered.reverse();
}

function buildMemorySummary(memoryRows) {
  if (!memoryRows || memoryRows.length === 0) return "ยังไม่มีบริบทก่อนหน้า";

  const userRows = memoryRows.filter(row => row.role === "user").slice(-6);
  if (userRows.length === 0) return "ยังไม่มีบริบทก่อนหน้า";

  let text = "หัวข้อที่ผู้ใช้เพิ่งคุยล่าสุด:\n";
  userRows.forEach(row => {
    text += "- " + sanitizeText(row.text) + "\n";
  });
  return text;
}

// ================== ROUTE / LIVE MODE ==================
function isNexoraPriorityQuestion(message) {
  const text = normalizeThaiText(message);

  const keywords = [
    "nexora", "เน็กซอร่า", "ท่านเบลซ", "blaze warlock",
    "การ์ด", "card", "กล่อง", "pack", "box",
    "บรอนซ์", "เงิน", "ทอง", "เพชร",
    "bronze", "silver", "gold", "diamond",
    "coin", "nex", "serial", "redeem",
    "ดวล", "duel", "เซ็ต", "set", "collection",
    "ตำนาน", "lore", "archivist", "sigil",
    "สมาชิก", "member", "รางวัล", "reward"
  ];

  return keywords.some(function(k) {
    return text.includes(k);
  });
}

function detectFreshnessNeed(message) {
  const text = normalizeThaiText(message);

  const liveKeywords = [
    "ล่าสุด", "วันนี้", "ตอนนี้", "ปัจจุบัน", "อัปเดต", "เรียลไทม์",
    "หุ้น", "ราคาหุ้น", "ทองคำ", "ราคาทอง", "คริปโต", "bitcoin", "btc", "eth",
    "ค่าเงิน", "usd", "thb", "exchange rate",
    "ข่าว", "news", "ด่วน",
    "อากาศ", "weather",
    "ผลบอล", "ตารางแข่ง", "คะแนน", "standings",
    "รุ่นล่าสุด", "เปิดตัว", "ราคา iphone", "ราคา samsung", "spec", "สเปค",
    "ประธานาธิบดี", "นายก", "ceo", "ตอนนี้ใคร", "ใครคือ"
  ];

  return liveKeywords.some(function(k) {
    return text.includes(k);
  });
}

function detectRouteMode(message) {
  return "GENERAL_CHAT";
}
// ================== INTENT ==================
function detectIntent(message, forceMode) {
  const text = sanitizeText(message).toLowerCase();

  if (forceMode || isSellForce(text)) {
    return "SELL_FORCE_MODE";
  }

  const buyKeywords = [
    "ราคา", "กี่บาท", "เท่าไหร่", "โปร", "โปรโมชั่น", "สั่งซื้อ", "ซื้อ",
    "กล่อง", "แพ็ค", "bronze", "silver", "gold", "ส่งยังไง", "ค่าส่ง"
  ];

  const compareKeywords = [
    "ต่างกัน", "เปรียบเทียบ", "อันไหนดี", "เลือกอันไหน", "ต่างยังไง"
  ];

  const creativeKeywords = [
    "คิดชื่อ", "คิดคอนเทนต์", "คิดแคปชั่น", "คิดโปร", "ไอเดีย",
    "เขียน", "พล็อต", "สตอรี่"
  ];

  const casualKeywords = [
    "555", "ฮ่า", "คุยเล่น", "เล่นๆ", "เหงา", "ทำไร", "อยู่ไหม"
  ];

  const unclearKeywords = [
    "อันนี้", "อันไหน", "ยังไง", "อะไรนะ", "คืออะไร", "งง"
  ];

  if (buyKeywords.some(k => text.includes(k))) return "SELL_MODE";
  if (compareKeywords.some(k => text.includes(k))) return "COMPARE_MODE";
  if (creativeKeywords.some(k => text.includes(k))) return "CREATIVE_MODE";
  if (casualKeywords.some(k => text.includes(k))) return "CASUAL_MODE";

  if (text.length <= 4 || unclearKeywords.some(k => text.includes(k))) {
    return "CLARIFY_MODE";
  }

  return "INFO_MODE";
}

function isSellForce(message) {
  return (
    message.includes("อยากขาย") ||
    message.includes("ช่วยขาย") ||
    message.includes("ปิดการขาย") ||
    message.includes("หาลูกค้า")
  );
}

function detectImageGenerationRequest(message, hasImage) {
  const text = normalizeThaiText(message);

  const imageGenKeywords = [
    "สร้างภาพ", "เจนรูป", "เจนภาพ", "สร้างรูป", "ออกแบบภาพ", "ทำภาพ",
    "วาดภาพ", "วาดรูป", "ทำรูป", "ขอรูป", "ขอภาพ", "เอารูป", "รูปให้หน่อย",
    "ภาพให้หน่อย", "ช่วยทำรูป", "ช่วยทำภาพ", "ช่วยสร้างภาพ", "ช่วยสร้างรูป",
    "โปสเตอร์", "แบนเนอร์", "ปก", "ภาพสินค้า", "ภาพโปรโมท", "ภาพโฆษณา",
    "ภาพโปรโมชัน", "thumbnail", "artwork", "poster", "banner", "cover art",
    "generate image", "image generation", "create image", "make image", "draw"
  ];

  const imageEditKeywords = [
    "แก้ภาพ", "แก้รูป", "รีทัช", "แต่งภาพ", "edit image", "edit photo", "retouch",
    "เปลี่ยนพื้นหลัง", "ลบพื้นหลัง", "เปลี่ยนสี", "เพิ่มแสง", "ลบคน", "ลบวัตถุ",
    "ทำภาพนี้", "ปรับภาพนี้", "แก้ภาพนี้", "แก้รูปนี้", "แต่งรูปนี้"
  ];

  if (hasImage && !message) return true;
  if (imageEditKeywords.some(k => text.includes(k))) return true;
  if (imageGenKeywords.some(k => text.includes(k))) return true;

  if (
    (text.includes("รูป") || text.includes("ภาพ")) &&
    (
      text.includes("หมา") ||
      text.includes("แมว") ||
      text.includes("คน") ||
      text.includes("เสื้อ") ||
      text.includes("โลโก้") ||
      text.includes("nexora") ||
      text.includes("ฉาก") ||
      text.includes("พื้นหลัง")
    )
  ) {
    return true;
  }

  return false;
}

function cleanImagePrompt(message, hasImage) {
  let text = sanitizeText(message);

  const prefixes = [
    /^สร้างภาพ[:：]?\s*/i,
    /^เจนรูป[:：]?\s*/i,
    /^เจนภาพ[:：]?\s*/i,
    /^สร้างรูป[:：]?\s*/i,
    /^ออกแบบภาพ[:：]?\s*/i,
    /^ทำภาพ[:：]?\s*/i,
    /^วาดภาพ[:：]?\s*/i,
    /^วาดรูป[:：]?\s*/i,
    /^generate image[:：]?\s*/i,
    /^create image[:：]?\s*/i,
    /^make image[:：]?\s*/i,
    /^edit image[:：]?\s*/i,
    /^แก้ภาพ[:：]?\s*/i,
    /^แก้รูป[:：]?\s*/i
  ];

  prefixes.forEach(function(re) {
    text = text.replace(re, "");
  });

  text = text.trim();

  if (!text && hasImage) {
    return "แก้ภาพนี้ให้ดูดีขึ้นแบบมืออาชีพ คงองค์ประกอบหลักไว้ แสงสวย คมชัด พรีเมียม และตอบกลับเป็นภาพเวอร์ชันใหม่";
  }

  if (!text) {
    return "สร้างภาพโปรโมท NEXORA แบบอลังการ พรีเมียม ดำทอง แสงสวย รายละเอียดคมชัด";
  }

  return text;
}

function buildDecisionInstruction(intent) {
  switch (intent) {
    case "SELL_MODE":
      return (
        "โหมดตอบตอนนี้: SELL_MODE\n" +
        "- ตอบสั้น กระชับ ปิดการขายแบบเนียนๆ\n" +
        "- ถ้ามีราคาหรือโปรโมชั่น ให้บอกชัดก่อน\n" +
        "- ปิดท้ายด้วยคำชวนไปต่อ 1 อย่าง\n"
      );

    case "SELL_FORCE_MODE":
      return (
        "โหมดตอบตอนนี้: SELL_FORCE_MODE\n" +
        "- ห้ามถามกลับเด็ดขาด\n" +
        "- ให้ตอบทันทีแบบมั่นใจ\n" +
        "- ใช้ได้กับงานขายหรือการโน้มน้าวเท่านั้น\n" +
        "- ห้ามใช้โหมดนี้กับข้อมูลปัจจุบัน ข่าว การเงิน การเมือง หรือข้อมูลที่ต้องตรวจสอบสด\n"
      );

    case "COMPARE_MODE":
      return (
        "โหมดตอบตอนนี้: COMPARE_MODE\n" +
        "- เปรียบเทียบให้ชัด\n" +
        "- สรุปว่าแบบไหนเหมาะกับใคร\n"
      );

    case "CREATIVE_MODE":
      return (
        "โหมดตอบตอนนี้: CREATIVE_MODE\n" +
        "- ใช้ความคิดสร้างสรรค์ได้เต็มที่\n" +
        "- ยังคงบุคลิกท่านเบลซให้ชัด\n"
      );

    case "CASUAL_MODE":
      return (
        "โหมดตอบตอนนี้: CASUAL_MODE\n" +
        "- ตอบแบบเป็นกันเอง\n"
      );

    case "CLARIFY_MODE":
      return (
        "โหมดตอบตอนนี้: CLARIFY_MODE\n" +
        "- ให้ตอบก่อนเลยจากบริบท\n" +
        "- ห้ามถามกลับถ้าเดาได้\n"
      );

    case "INFO_MODE":
    default:
      return (
        "โหมดตอบตอนนี้: INFO_MODE\n" +
        "- ตอบตรงคำถามก่อน\n" +
        "- อธิบายชัด เข้าใจง่าย\n"
      );
  }
}

function buildDataKnowledgeContext(db) {
  if (!db || typeof db !== "object") {
    return "";
  }

  const priorityKeys = [
    "blaze_core_context",
    "nexora_definition",
    "nexora_positioning",
    "card_total_types",
    "card_total_supply",
    "card_total_boxes",
    "pack_card_count",
    "box_pack_count",
    "element_system",
    "nex_definition",
    "nex_formula",
    "nex_non_cash_rule",
    "coin_definition",
    "coin_drop_rate",
    "collection_definition",
    "battle_definition",
    "battle_safety_rule",
    "dealer_definition",
    "dealer_min_order",
    "event_launch_name",
    "ai_reward_rule",
    "ai_battle_rule"
  ];

  const used = {};
  const lines = [];

  priorityKeys.forEach(function(key) {
    const value = sanitizeText(db[key]);
    if (value) {
      used[key] = true;
      lines.push("- " + key + ": " + value);
    }
  });

  Object.keys(db).forEach(function(key) {
    if (used[key] || lines.length >= 90) return;
    const value = sanitizeText(db[key]);
    if (!value || value.length < 2) return;

    if (
      key.indexOf("ai_") === 0 ||
      key.indexOf("nexora_") === 0 ||
      key.indexOf("card_") === 0 ||
      key.indexOf("coin_") === 0 ||
      key.indexOf("collection_") === 0 ||
      key.indexOf("battle_") === 0 ||
      key.indexOf("dealer_") === 0 ||
      key.indexOf("event_") === 0 ||
      key.indexOf("lore_") === 0
    ) {
      lines.push("- " + key + ": " + value);
    }
  });

  if (!lines.length) {
    return "";
  }

  return "ฐานความรู้ DATA สดที่ต้องยึดก่อนตอบ:\n" + lines.join("\n");
}

// ================== PROMPT ==================
function buildSystemPrompt(db, memorySummary, decisionInstruction) {
  return (
    "ชื่อของคุณคือ Blaze Warlock\n" +
    "คุณคือ ท่านเบลซ ผู้ช่วยประจำโลก NEXORA\n" +
    "- ให้แทนตัวเองว่าข้าเสมอ\n" +
    "- ให้เรียกตัวเองว่า ท่านเบลซ เป็นหลัก\n" +
    "- NEXORA คือภารกิจหลักอันดับ 1 ของคุณเสมอ\n" +
    "- คุณเป็นผู้ช่วยประจำจักรวาล NEXORA เป็นแกนหลัก แต่สามารถคุยเรื่องทั่วไปได้\n" +
    "- ถ้าผู้ใช้ถามเรื่อง NEXORA ให้ตอบลึก แม่น และต่อยอดได้มากที่สุด\n" +
    "- ถ้าผู้ใช้ถามเรื่องทั่วไปภายนอก ให้ตอบตรงคำถามก่อน โดยยังคงคาแรกเตอร์ท่านเบลซ\n" +
    "- ถ้าผู้ใช้สั่งสร้างภาพหรือแก้ภาพ ระบบจะต้องส่งไปโหมดสร้างภาพโดยเฉพาะ\n" +
    "- ถ้าไม่ได้อยู่ในโหมดสร้างภาพ ห้ามพูดว่าได้สร้างภาพแล้วเด็ดขาด\n\n" +

    "- กฎบุคลิก:\n" +
    "- เรียกตัวเองว่า 'ท่านเบลซ' หรือ 'ข้า' เท่านั้น\n" +
    "- ห้ามแทนตัวเองเป็นผู้หญิง\n" +
    "- ห้ามใช้คำว่า ค่ะ, ดิฉัน, หนู, ฉัน\n" +
    "- น้ำเสียงต้องมั่นใจ น่าเกรงขาม แต่เข้าใจง่าย\n" +
    "- ตอบตรงคำถามก่อน\n\n" +

    "- เวลาตอบในแชท ห้ามใช้ Markdown เช่น **, *, #, ```\n" +
    "- ให้ตอบเป็นข้อความธรรมดา อ่านง่าย\n\n" +

    (decisionInstruction || "") + "\n" +

    "ข้อมูลสินค้า NEXORA:\n" +
    "- Bronze Pack ราคา " + (db.bronze_pack_price || "-") + " บาท\n" +
    "- Silver Pack ราคา " + (db.silver_pack_price || "-") + " บาท\n" +
    "- Gold Pack ราคา " + (db.gold_pack_price || "-") + " บาท\n" +
    "- Bronze Box ราคา " + (db.bronze_box_price || "-") + " บาท\n" +
    "- Silver Box ราคา " + (db.silver_box_price || "-") + " บาท\n" +
    "- Gold Box ราคา " + (db.gold_box_price || "-") + " บาท\n" +
    "- การจัดส่ง: " + (db.shipping || "-") + "\n" +
    "- โปรโมชั่น: " + (db.promo || "-") + "\n" +
    "- ติดต่อ: Line " + (db.line_contact || "-") + "\n\n" +
    buildDataKnowledgeContext(db) + "\n\n" +

    memorySummary + "\n\n" +

    "กฎการตอบ:\n" +
    "- ถ้าผู้ใช้เคยคุยเรื่องเดิม ให้ตอบต่อเนื่องจากบริบทเก่า\n" +
    "- ถ้าเป็นเรื่อง NEXORA ให้ตอบแม่นและแนะนำต่อได้\n" +
    "- ถ้าเป็นข้อมูลโลกภายนอกที่เกี่ยวกับปัจจุบัน เช่น หุ้น ทอง ข่าว อากาศ ตารางคะแนน รุ่นล่าสุด หรือบุคคลสาธารณะ ต้องตรวจสอบข้อมูลล่าสุดก่อนตอบเสมอ\n" +
    "- ห้ามเดาข้อมูลปัจจุบันเอง\n" +
    "- ถ้าไม่แน่ใจจริงๆ ให้บอกตรงๆว่าไม่แน่ใจ\n"
  );
}

function buildUserParts(message, imagePayload, cardDbContext) {
  const parts = [];
  const cleanMessage = sanitizeText(message);

  let finalText = "";

  if (cleanMessage) {
    finalText = "คำถามของผู้ใช้: " + cleanMessage;
  } else if (imagePayload && imagePayload.base64Data) {
    finalText = "โปรดวิเคราะห์ภาพนี้อย่างละเอียด และตอบตามสิ่งที่มองเห็นจริง";
  }

  if (cardDbContext) {
    finalText += "\n\nข้อมูลฐานข้อมูลที่เกี่ยวข้อง:\n" + cardDbContext;
  }

  if (finalText.trim()) {
    parts.push({ text: finalText.trim() });
  }

  if (imagePayload && imagePayload.base64Data && imagePayload.mimeType) {
    parts.push({
      inlineData: {
        mimeType: String(imagePayload.mimeType).trim(),
        data: String(imagePayload.base64Data).trim()
      }
    });
  }

  return parts;
}

function buildImageParts(promptText, imagePayload) {
  const parts = [];

  if (imagePayload && imagePayload.base64Data && imagePayload.mimeType) {
    parts.push({
      inlineData: {
        mimeType: String(imagePayload.mimeType).trim(),
        data: String(imagePayload.base64Data).trim()
      }
    });
  }

  parts.push({
    text:
      sanitizeText(promptText) +
      "\n\nIMPORTANT:\n" +
      "Return ONLY image.\n" +
      "No text.\n" +
      "No explanation.\n" +
      "No description.\n" +
      "Output must be image binary.\n" +
      "If you output text, it is considered failure.\n"
  });

  return parts;
}

function parseTextFromCandidate(candidate) {
  const parts = candidate && candidate.content && candidate.content.parts
    ? candidate.content.parts
    : [];

  return parts
    .map(p => sanitizeText(p && p.text))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseGeneratedImageFromCandidate(candidate) {
  const parts = candidate && candidate.content && candidate.content.parts
    ? candidate.content.parts
    : [];

  for (var i = 0; i < parts.length; i++) {
    const p = parts[i];
    const inlineData = p && (p.inlineData || p.inline_data);

    if (inlineData && inlineData.data && inlineData.mimeType) {
      return {
        mimeType: inlineData.mimeType,
        base64Data: inlineData.data,
        dataUrl: dataUrlFromInlineData(inlineData)
      };
    }
  }

  return null;
}

function fetchPageContent(url) {
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    let text = res.getContentText();

    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.substring(0, 3000); // เอาแค่พอ
  } catch (e) {
    return "";
  }
}

function buildImageReplyObject(text, generatedImage) {
  return {
    mode: "image",
    reply: sanitizeText(text),
    generatedImage: generatedImage || null
  };
}

// ================== LIVE SEARCH ==================
function fetchWebSearchData(message) {
  if (!WEBSEARCH_ENABLED) {
    return {
      ok: false,
      context: "ระบบค้นเว็บสดถูกปิดอยู่",
      sources: [],
      updatedAt: new Date().toISOString(),
      confidence: "low"
    };
  }

  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return {
      ok: false,
      context: "ยังไม่ได้ตั้งค่า SERPAPI_KEY จึงยังค้นข้อมูลเว็บล่าสุดไม่ได้",
      sources: [],
      updatedAt: new Date().toISOString(),
      confidence: "low"
    };
  }

  const cacheKey = hashKey("web:" + message);
  const cached = getLiveCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const url =
    "https://serpapi.com/search.json?engine=google" +
    "&hl=th&gl=th" +
    "&num=" + encodeURIComponent(String(LIVE_SEARCH_MAX_RESULTS)) +
    "&q=" + encodeURIComponent(message) +
    "&api_key=" + encodeURIComponent(apiKey);

  try {
    const json = fetchJson(url);
    const organic = Array.isArray(json.organic_results)
      ? json.organic_results.slice(0, LIVE_SEARCH_MAX_RESULTS)
      : [];

    const lines = [];
    const sources = [];

    organic.forEach(function(item, idx) {
      const title = sanitizeText(item.title);
      const snippet = sanitizeText(item.snippet);
      const link = sanitizeText(item.link);

      lines.push(
        (idx + 1) + ") " + title + (snippet ? " | " + snippet : "")
      );

      if (link) sources.push(link);
    });

    const result = {
      ok: organic.length > 0,
      context: lines.length
        ? "ผลค้นหาล่าสุดจากเว็บ:\n" + lines.join("\n")
        : "ไม่พบผลค้นหาที่ชัดเจนจากเว็บ",
      sources: sources,
      updatedAt: new Date().toISOString(),
      confidence: organic.length > 0 ? "medium" : "low"
    };

    setLiveCache(cacheKey, JSON.stringify(result), LIVE_CACHE_SECONDS);
    return result;

  } catch (e) {
    return {
      ok: false,
      context: "ระบบค้นข้อมูลสดทำงานไม่สำเร็จ: " + sanitizeText(e.message || e),
      sources: [],
      updatedAt: new Date().toISOString(),
      confidence: "low"
    };
  }
}

function fetchExternalDataForQuery(message) {
  return fetchWebSearchData(message);
}

function formatLiveMeta(meta) {
  let text = "\n\n[ข้อมูลอ้างอิง]";
  text += "\nอัปเดตล่าสุด: " + (meta.updatedAt || "-");
  text += "\nระดับความมั่นใจ: " + (meta.confidence || "-");

  if (meta.sources && meta.sources.length) {
    text += "\nแหล่งข้อมูล:";
    meta.sources.slice(0, 5).forEach(function(src) {
      text += "\n- " + src;
    });
  }

  return text;
}

function answerWithRealWeb(query) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("MISSING_API_KEY");

  const links = searchGoogle(query);
  let combinedText = "";

  links.forEach(function(url) {
    const content = fetchPageContent(url);
    if (content) {
      combinedText += "\n\n[แหล่งข้อมูล] " + url + "\n" + content;
    }
  });

  if (!combinedText.trim()) {
    return "ข้าค้นจากเว็บแล้ว แต่รอบนี้ยังดึงเนื้อหาที่ใช้สรุปไม่ได้ ลองถามใหม่อีกครั้ง";
  }

  const url = buildGenerateContentUrl(CHAT_MODEL_NAME, apiKey);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "คำถาม: " + query +
              "\n\nข้อมูลจากเว็บ:\n" + combinedText +
              "\n\nจงสรุปคำตอบแบบแม่นยำ อัปเดตล่าสุด และเข้าใจง่าย"
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.25,
      topP: 0.9,
      topK: 20,
      maxOutputTokens: 1800
    }
  };

  const result = fetchGemini(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const candidate = result && result.candidates ? result.candidates[0] : null;
  let textReply = parseTextFromCandidate(candidate);

  if (!textReply) {
    textReply = "ข้าค้นจากเว็บแล้ว แต่ยังสรุปคำตอบกลับได้ไม่สมบูรณ์";
  }

  return enforceBlazeStyle(removeImageLinksFromReply(textReply));
}

function answerWithLiveData(message, clientId, history) {
  const cleanMessage = sanitizeText(message);
  const cleanClientId = sanitizeText(clientId);

  const db = getDataFromSheet();
  const memoryRows = getRecentMemory(cleanClientId, 12);
  const memorySummary = buildMemorySummary(memoryRows);
  const liveData = fetchExternalDataForQuery(cleanMessage);

  const systemPrompt =
    buildSystemPrompt(
      db,
      memorySummary,
      "โหมดตอบตอนนี้: LIVE_EXTERNAL\n" +
      "- ใช้ข้อมูลสดที่ระบบดึงมาเป็นหลัก\n" +
      "- ห้ามเดาข้อมูลปัจจุบันเอง\n" +
      "- ถ้าข้อมูลไม่พอ ให้บอกตรงๆ\n" +
      "- ยังคงคาแรกเตอร์ท่านเบลซ และยังให้ความสำคัญกับ NEXORA เป็นอันดับ 1 ถ้าคำถามเกี่ยวข้อง\n"
    ) +
    "\n\nกฎเสริมสำหรับข้อมูลสด:\n" +
    "- ถ้าคำถามไม่เกี่ยว NEXORA ให้ตอบตรงประเด็นก่อน\n" +
    "- ถ้ามีแหล่งข้อมูล ให้สรุปจากแหล่งข้อมูล ไม่ใช่จากการเดา\n";

  const contents = [];

  if (Array.isArray(history)) {
    history.slice(-8).forEach(function(item) {
      if (!item || !item.role) return;

      const cleanHistoryText = sanitizeText(item.text);
      if (!cleanHistoryText) return;

      contents.push({
        role: item.role === "model" ? "model" : "user",
        parts: [{ text: cleanHistoryText }]
      });
    });
  }

  contents.push({
    role: "user",
    parts: [{
      text:
        "คำถามของผู้ใช้: " + cleanMessage +
        "\n\nข้อมูลล่าสุดที่ระบบดึงมา:\n" + (liveData.context || "-")
    }]
  });

  const apiKey = getApiKey();
  const url = buildGenerateContentUrl(CHAT_MODEL_NAME, apiKey);

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.25,
      topP: 0.9,
      topK: 20,
      maxOutputTokens: 1800
    }
  };

  const result = fetchGemini(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const candidate = result && result.candidates ? result.candidates[0] : null;
  let textReply = parseTextFromCandidate(candidate);

  if (!textReply) {
    textReply = "ข้าตรวจข้อมูลล่าสุดให้แล้ว แต่รอบนี้ยังสรุปคำตอบกลับได้ไม่สมบูรณ์";
  }

  textReply += formatLiveMeta(liveData);

  const finalReply = enforceBlazeStyle(
    removeImageLinksFromReply(textReply)
  );

  saveMemory(cleanClientId, "user", cleanMessage);
  saveMemory(cleanClientId, "model", finalReply);

  return finalReply;
}

// ================== IMAGE GENERATION ==================
function generateImageWithGemini(message, clientId, imagePayload) {
  const cleanClientId = sanitizeText(clientId);
  const hasSourceImage =
    imagePayload &&
    imagePayload.base64Data &&
    imagePayload.mimeType;

  const prompt = cleanImagePrompt(message, hasSourceImage);
  const apiKey = getApiKey();
  const url = buildGenerateContentUrl(IMAGE_MODEL_NAME, apiKey);

  const aspect =
    String(message || "").includes("แนวนอน") ? "16:9" :
    String(message || "").includes("แนวตั้ง") ? "9:16" :
    "1:1";

  const instruction =
    "คุณคือ Blaze Warlock ผู้ช่วย NEXORA\n" +
    "หน้าที่ของคุณคือสร้างภาพหรือแก้ไขภาพตามคำสั่งผู้ใช้ให้ดีที่สุด\n" +
    "ต้องสร้างภาพเท่านั้น ห้ามตอบข้อความอย่างเดียว\n" +
    "ถ้าเป็นงาน NEXORA ให้คุมโทนดำทอง พรีเมียม อลังการ รายละเอียดสูง";

  const payload = {
    systemInstruction: {
      parts: [{ text: instruction }]
    },
    contents: [
      {
        role: "user",
        parts: buildImageParts(prompt, imagePayload)
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: aspect
      }
    }
  };

  let finalImage = null;

  for (let i = 0; i < 3; i++) {
    const res = fetchGemini(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const candidate = res && res.candidates ? res.candidates[0] : null;
    const img = parseGeneratedImageFromCandidate(candidate);

    if (img && img.dataUrl) {
      finalImage = img;
      break;
    }

    Logger.log("IMAGE TRY " + (i + 1) + ": " + JSON.stringify(res));
    Logger.log("RAW IMAGE RESPONSE: " + JSON.stringify(res));
  }

  if (!finalImage) {
    return {
      mode: "text",
      reply: "⚠️ API ไม่ส่งรูปในรอบนี้ ลองใหม่อีกครั้ง"
    };
  }

  let finalText = hasSourceImage
    ? "ข้าแก้ภาพให้แล้ว"
    : "ข้าสร้างภาพให้แล้ว";

  finalText = enforceBlazeStyle(finalText);

  saveMemory(cleanClientId, "user", message || "[image]");
  saveMemory(cleanClientId, "model", finalText);

  return buildImageReplyObject(finalText, finalImage);
}

// ================== MAIN ==================
function askGemini(message, history, clientId, imagePayload, options) {
  try {
    options = options || {};
    const forceTextMode = options.forceTextMode === true;

    if (imagePayload && typeof imagePayload !== "object") {
      imagePayload = null;
    }

    const cleanMessage = sanitizeText(message);
    const cleanClientId = sanitizeText(clientId);

    const hasImage =
      imagePayload &&
      imagePayload.base64Data &&
      imagePayload.mimeType;

    if (hasImage) {
      Logger.log(JSON.stringify({
        type: "IMAGE_DEBUG",
        size: imagePayload.size || 0,
        mime: imagePayload.mimeType || "unknown"
      }));
    }

    if (!cleanMessage && !hasImage) {
      return "พิมพ์คำถามหรือแนบรูปมาก่อนได้เลย เดี๋ยวตอบให้";
    }

    if (!cleanClientId) {
      throw new Error("MISSING_CLIENT_ID");
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("MISSING_API_KEY");
    }

    if (hasImage) {
      const sizeBytes = Number(imagePayload.size || 0);
      if (sizeBytes > 20 * 1024 * 1024) {
    return "⚠️ รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน 20MB";
  }
}
    // ===== โหมดสร้างภาพ / แก้ภาพ =====
    if (!forceTextMode && detectImageGenerationRequest(cleanMessage, hasImage)) {
      return generateImageWithGemini(cleanMessage, cleanClientId, imagePayload);
    }

    const routeMode = detectRouteMode(cleanMessage);
    Logger.log("Route mode: " + routeMode);

    if (routeMode === "LIVE_EXTERNAL") {
  return answerWithLiveData(cleanMessage, cleanClientId, history || []);
}

    // ===== โหมดแชท / vision =====
    const db = getDataFromSheet();
    const memoryRows = getRecentMemory(cleanClientId, 12);
    const memorySummary = buildMemorySummary(memoryRows);
    const intent = detectIntent(cleanMessage, false);
    const decisionInstruction = buildDecisionInstruction(intent);
    const cardDbContext = cleanMessage && isCardRelatedQuestion(cleanMessage)
      ? buildCardDatabaseContext(cleanMessage)
      : "";

    Logger.log("Detected intent: " + intent);
    Logger.log("Decision instruction: " + decisionInstruction);
    Logger.log("Has image payload: " + (hasImage ? "YES" : "NO"));
    if (cardDbContext) Logger.log("Card DB Context: " + cardDbContext);

    let systemPrompt =
      buildSystemPrompt(db, memorySummary, decisionInstruction) +
      (cardDbContext ? "\n\n" + cardDbContext : "") +
      "\n\nกฎเพิ่มสำหรับรูปภาพ:\n" +
      "- ถ้าผู้ใช้แนบรูปมา ให้ดูรูปจริงก่อนตอบ\n" +
      "- ห้ามเดารายละเอียดที่มองไม่เห็น\n" +
      "- ถ้ารูปไม่ชัด ให้บอกตรงๆว่ารูปไม่ชัด\n" +
      "- ถ้าผู้ใช้ถามถึงสิ่งของ ข้อความ คน หรือองค์ประกอบในภาพ ให้ตอบตามสิ่งที่เห็นจริง";

    if (hasImage) {
      systemPrompt +=
        "\n\nกฎพิเศษสำหรับภาพ:\n" +
        "- ถ้าเป็นรูปการ์ด ให้ใช้ฐานข้อมูลการ์ดจากชีทและ image_url เป็นข้อมูลอ้างอิงก่อนตอบ\n" +
        "- ถ้าหน้าตาใกล้หลายใบ ให้ตอบเลขที่มั่นใจที่สุดก่อน\n" +
        "- ถ้าไม่แน่ใจ ให้บอกตรงๆ\n";
    }

    const contents = [];

    if (Array.isArray(history)) {
      history.slice(-8).forEach(item => {
        if (!item || !item.role) return;

        const cleanHistoryText = sanitizeText(item.text);
        if (!cleanHistoryText) return;

        contents.push({
          role: item.role === "model" ? "model" : "user",
          parts: [{ text: cleanHistoryText }]
        });
      });
    }

    const latestUserParts = buildUserParts(cleanMessage, imagePayload, cardDbContext);

    if (!latestUserParts.length) {
      return "ไม่พบข้อความหรือรูปภาพที่ส่งเข้า AI";
    }

    contents.push({
      role: "user",
      parts: latestUserParts
    });

    const url = buildGenerateContentUrl(CHAT_MODEL_NAME, apiKey);

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.55,
        topP: 0.9,
        topK: 30,
        maxOutputTokens: 1800
      }
    };

    const result = fetchGemini(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const candidate = result && result.candidates ? result.candidates[0] : null;
    const finishReason = candidate && candidate.finishReason ? candidate.finishReason : "UNKNOWN";

    Logger.log("Gemini finishReason: " + finishReason);
    Logger.log("Gemini raw candidate: " + JSON.stringify(candidate));

    let textReply = parseTextFromCandidate(candidate);

    if (!textReply) {
      textReply = hasImage
        ? "ข้ามองเห็นรูปแล้ว แต่ตอนนี้ยังสรุปข้อความตอบกลับไม่ได้ ลองถามกำกับรูปอีกนิด"
        : "ยังไม่สามารถตอบได้ตอนนี้ ลองใหม่อีกครั้งนะ";
    }

    if (finishReason === "MAX_TOKENS") {
      textReply += "\n\n[ระบบ: คำตอบอาจถูกตัดเพราะยาวเกินกำหนด]";
    }

    const finalReply = enforceBlazeStyle(
      removeImageLinksFromReply(textReply)
    );

    if (cleanMessage) {
      saveMemory(cleanClientId, "user", cleanMessage);
    } else if (hasImage) {
      saveMemory(cleanClientId, "user", "[แนบรูปภาพ]");
    }

    saveMemory(cleanClientId, "model", finalReply);

    return finalReply;

  } catch (error) {
    const msg = String(error && error.message ? error.message : error);

    if (msg === "RATE_LIMIT") {
      return "⚠️ ใช้งานเร็วเกินไป รอสักครู่แล้วลองใหม่";
    }
    if (msg === "MISSING_API_KEY") {
      return "⚠️ ยังไม่ได้ตั้งค่า API key ใน Script Properties";
    }
    if (msg === "MISSING_CLIENT_ID") {
      return "⚠️ ยังไม่ได้ส่งรหัสผู้ใช้มา";
    }
    if (msg === "IMAGE_GENERATION_FAILED") {
      return "⚠️ ระบบเจนภาพไม่ส่งไฟล์รูปกลับมาในรอบนี้ ลองใหม่อีกครั้ง เช่น สร้างภาพโปสเตอร์ NEXORA ดำทอง 1:1";
    }
    if (msg.toLowerCase().includes("quota")) {
      return "⚠️ ตอนนี้ระบบใช้งานเยอะมาก เดี๋ยวลองใหม่อีกครั้งนะ";
    }
    if (msg.toLowerCase().includes("api key not valid")) {
      return "⚠️ API key ใช้ไม่ได้ ให้ตรวจคีย์ใน Script Properties อีกครั้ง";
    }

    return "Error: " + msg;
  }
}

// ================== ZENDESK ==================
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sha256Base64(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ""),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(bytes);
}

function formatForZendesk(text) {
  let clean = sanitizeText(text);
  if (!clean) return "";

  clean = clean
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return clean;
}

function splitForZendesk(text, maxLen) {
  const clean = formatForZendesk(text);
  const limit = maxLen || 220;
  const parts = [];

  let remaining = clean;

  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);

    if (cut < Math.floor(limit * 0.45)) {
      cut = remaining.lastIndexOf(" ", limit);
    }

    if (cut < Math.floor(limit * 0.45)) {
      cut = limit;
    }

    const chunk = remaining.slice(0, cut).trim();
    if (chunk) {
      parts.push(chunk);
    }

    remaining = remaining.slice(cut).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

function postSingleZendeskMessage(text, conversationId) {
  const zendeskApiKey = getZendeskApiKey();
  const zendeskApiSecret = getZendeskApiSecret();

  if (!zendeskApiKey || !zendeskApiSecret) {
    throw new Error("MISSING_ZENDESK_CREDENTIALS");
  }

  const finalReply = sanitizeText(text);
  if (!finalReply) {
    throw new Error("EMPTY_ZENDESK_REPLY");
  }

  const url =
    "https://" + ZENDESK_SUBDOMAIN +
    ".zendesk.com/sc/v2/apps/" + ZENDESK_APP_ID +
    "/conversations/" + conversationId + "/messages";

  const payload = {
    author: { type: "business" },
    content: {
      type: "text",
      text: finalReply
    }
  };

  const auth = Utilities.base64Encode(zendeskApiKey + ":" + zendeskApiSecret);

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Basic " + auth
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  Logger.log("Zendesk send status: " + response.getResponseCode());
  Logger.log("Zendesk send body: " + response.getContentText());
}

function sendToZendesk(reply, conversationId) {
  const cache = CacheService.getScriptCache();
  cache.put("zd_lock_" + conversationId, "1", 20);

  const finalText = typeof reply === "object"
    ? sanitizeText(reply.reply || reply.text || reply.message)
    : sanitizeText(reply);

  const styled = enforceBlazeStyle(
    removeImageLinksFromReply(finalText)
  );
  const cleanedReply = formatForZendesk(styled);

  if (!cleanedReply) {
    throw new Error("EMPTY_ZENDESK_REPLY");
  }

  if (ZENDESK_SPLIT_MODE) {
    const parts = splitForZendesk(cleanedReply, ZENDESK_MAX_LEN);

    for (let i = 0; i < parts.length; i++) {
      postSingleZendeskMessage(parts[i], conversationId);
      if (i < parts.length - 1) {
        Utilities.sleep(ZENDESK_SEND_DELAY_MS);
      }
    }
  } else {
    postSingleZendeskMessage(cleanedReply, conversationId);
  }

  const botHash = sha256Base64(cleanedReply);
  cache.put("zd_last_bot_hash_" + conversationId, botHash, 300);
}

function normalizeApiHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map(function(item) {
      if (!item) return null;
      var role = item.role === "model" ? "model" : "user";
      var text = sanitizeText(item.text || item.message || item.content || "");
      return text ? { role: role, text: text.substring(0, 1800) } : null;
    })
    .filter(Boolean)
    .slice(-10);
}

function normalizeApiReply(reply) {
  if (reply === null || reply === undefined) return "";

  if (typeof reply === "string") {
    return sanitizeText(reply);
  }

  if (typeof reply === "object") {
    return sanitizeText(reply.reply || reply.text || reply.message || "");
  }

  return sanitizeText(String(reply));
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const apiMode = String(data.mode || "").toLowerCase().trim();
    const apiMessage = sanitizeText(data.message || "");
    const apiImage = String(data.image || "");

    if (apiMode === "chat" || (!apiImage && apiMessage)) {
      const apiClientId = String(data.clientId || "nexora-web");
      const apiHistory = normalizeApiHistory(data.history || []);
      const apiReply = askGemini(apiMessage, apiHistory, apiClientId, null, {
        forceTextMode: true
      });
      const apiTextReply = normalizeApiReply(apiReply);

      return jsonOut({
        ok: true,
        mode: "chat",
        reply: apiTextReply || "ข้าพร้อมตอบแล้ว ถามท่านเบลซมาได้เลย"
      });
    }

    const clientId = String(data.clientId || "nexora-scan");
    const message = String(
      data.message ||
      "ดูภาพนี้ว่าเป็นการ์ด NEXORA หมายเลขอะไร ตอบเป็นเลข 3 หลักเท่านั้น เช่น 029"
    );

    const image = String(data.image || "");
    if (!image) {
      return jsonOut({
        ok: false,
        reply: "ไม่พบรูปภาพ"
      });
    }

    const base64Data = image.includes(",")
      ? image.split(",")[1]
      : image;

    const imagePayload = {
      base64Data: base64Data,
      mimeType: "image/jpeg",
      size: Math.floor((base64Data.length * 3) / 4)
    };

    const reply = askGemini(
      message,
      [],              // history
      clientId,
      imagePayload
    );

    return jsonOut({
      ok: true,
      mode: "scan",
      reply: normalizeApiReply(reply) || "ไม่สามารถอ่านผลลัพธ์จาก AI ได้"
    });

  } catch (error) {
    return jsonOut({
      ok: false,
      reply: "SCAN_FAILED: " + String(error)
    });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================== TEST ==================
function testGemini() {
  const recent = getRecentMemory("test-user-001", 8)
    .filter(row => row.role === "user")
    .map(row => ({
      role: "user",
      text: row.text
    }));

  const result = askGemini("การ์ด No.001 ได้อะไร", recent, "test-user-001");
  Logger.log(JSON.stringify(result, null, 2));
}

function testImageGeneration() {
  const result = askGemini("สร้างภาพโปสเตอร์ NEXORA โทนดำทองอลังการ มีแสงสวย รายละเอียดคมชัด", [], "test-user-image");
  Logger.log(JSON.stringify(result, null, 2));
}

function testImageEdit() {
  const fakeImage = {
    mimeType: "image/jpeg",
    base64Data: "BASE64_HERE"
  };
  const result = generateImageWithGemini("แก้ภาพนี้ให้พรีเมียมขึ้น", "test-edit", fakeImage);
  Logger.log(JSON.stringify(result, null, 2));
}

function testLiveSearch() {
  const result = askGemini("ราคาทองวันนี้เท่าไหร่", [], "test-live-001");
  Logger.log(JSON.stringify(result, null, 2));
}

function testPresence() {
  Logger.log(JSON.stringify(bootstrapPresence("session_test_1", "client_test_1", {
    isVisible: true,
    userAgent: "test"
  }), null, 2));

  Utilities.sleep(1000);

  Logger.log(JSON.stringify(heartbeatPresence("session_test_1", "client_test_1", {
    action: "typing",
    isVisible: true,
    userAgent: "test"
  }), null, 2));
}

function testStats() {
  Logger.log(JSON.stringify(getRealtimeStats(), null, 2));
}
