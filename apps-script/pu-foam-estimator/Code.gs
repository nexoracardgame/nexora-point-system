const SPREADSHEET_ID = "16DUFT3J9j-XSlm5DU6__9OyuE7UkVFEipDPOWfx_Lng";
const HISTORY_SHEET = "PU Foam Deposit History";
const TRAVEL_SHEET = "Travel Estimate History";
const ORIGIN_MAPS_URL = "https://maps.app.goo.gl/uUVgNPohpKC4uW6Q8";
const HISTORY_HEADERS = [
  "Timestamp",
  "Job Type",
  "Total Amount",
  "Payment 1",
  "Payment 2",
  "Payment 3",
  "User Agent",
  "Payment 1 %",
  "Payment 2 %",
  "Payment 3 %"
];
const TRAVEL_HEADERS = [
  "Timestamp",
  "Origin",
  "Destination Input",
  "Destination",
  "Subdistrict",
  "District",
  "Province",
  "Distance Km",
  "Rate Per Km",
  "Estimated Travel Cost",
  "Duration",
  "User Agent"
];

function doGet() {
  setupDatabase_();
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("PU Foam Deposit Calculator")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getInitialState() {
  setupDatabase_();
  return {
    ok: true,
    spreadsheetId: SPREADSHEET_ID,
    rates: {
      first: 50,
      second: 30,
      final: 20
    },
    travel: {
      originUrl: ORIGIN_MAPS_URL,
      defaultRate: 15
    }
  };
}

function saveCalculation(payload) {
  setupDatabase_();
  const data = payload || {};
  const total = roundMoney_(parseNumber_(data.total));
  if (total <= 0) {
    return { ok: false, saved: false };
  }

  const rates = normalizeDepositRates_(data.rates);
  const first = roundMoney_(total * rates.first / 100);
  const second = roundMoney_(total * rates.second / 100);
  const finalPayment = roundMoney_(total * rates.final / 100);
  getSheet_(HISTORY_SHEET).appendRow([
    new Date(),
    "งานพ่นโฟม",
    total,
    first,
    second,
    finalPayment,
    String(data.userAgent || "").slice(0, 300),
    rates.first,
    rates.second,
    rates.final
  ]);
  formatDatabase_();

  return {
    ok: true,
    saved: true,
    total,
    first,
    second,
    final: finalPayment,
    rates
  };
}

function estimateTravel(payload) {
  setupDatabase_();
  const data = payload || {};
  const input = String(data.location || "").trim();
  const rate = parseNumber_(data.rate) || 15;
  if (!input) {
    throw new Error("กรุณาวางลิงก์โลเคชั่นหน้างานก่อน");
  }

  const origin = getOriginLocation_();
  const destination = parseLocationInput_(input);
  const directions = Maps.newDirectionFinder()
    .setOrigin(origin.query)
    .setDestination(destination.query)
    .setMode(Maps.DirectionFinder.Mode.DRIVING)
    .getDirections();
  const route = directions && directions.routes && directions.routes[0];
  if (!route || !route.legs || !route.legs.length) {
    throw new Error("ไม่สามารถคำนวณเส้นทางจากลิงก์นี้ได้");
  }

  const totals = route.legs.reduce((acc, leg) => {
    acc.distanceMeters += leg.distance && leg.distance.value ? Number(leg.distance.value) : 0;
    acc.durationSeconds += leg.duration && leg.duration.value ? Number(leg.duration.value) : 0;
    return acc;
  }, { distanceMeters: 0, durationSeconds: 0 });
  const distanceKm = roundDistance_(totals.distanceMeters / 1000);
  const estimatedCost = roundTravelCost_(distanceKm * rate);
  const durationText = formatDuration_(totals.durationSeconds);
  const endLocation = route.legs[route.legs.length - 1].end_location || {};
  const address = getAddressParts_(endLocation, destination);

  getSheet_(TRAVEL_SHEET).appendRow([
    new Date(),
    origin.label,
    input,
    destination.label,
    address.subdistrict,
    address.district,
    address.province,
    distanceKm,
    rate,
    estimatedCost,
    durationText,
    String(data.userAgent || "").slice(0, 300)
  ]);
  formatDatabase_();

  return {
    ok: true,
    origin: origin.label,
    destination: destination.label,
    address,
    distanceKm,
    rate,
    estimatedCost,
    durationText
  };
}

function setupDatabase_() {
  const sheet = getSheet_(HISTORY_SHEET);
  ensureHeaders_(sheet, HISTORY_HEADERS);
  ensureHeaders_(getSheet_(TRAVEL_SHEET), TRAVEL_HEADERS);
  formatDatabase_();
}

function getSheet_(name) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  const width = headers.length;
  const current = sheet.getRange(1, 1, 1, width).getValues()[0];
  const missing = headers.some((header, index) => String(current[index] || "").trim() !== header);
  if (missing) {
    sheet.getRange(1, 1, 1, width).setValues([headers]);
  }
}

function formatDatabase_() {
  formatSheet_(getSheet_(HISTORY_SHEET), HISTORY_HEADERS, 3, 4);
  formatSheet_(getSheet_(TRAVEL_SHEET), TRAVEL_HEADERS, 8, 3);
}

function formatSheet_(sheet, headers, moneyStartColumn, moneyColumnCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#09090b")
    .setFontColor("#f7d46a")
    .setFontWeight("bold");
  sheet.autoResizeColumns(1, headers.length);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, moneyStartColumn, sheet.getLastRow() - 1, moneyColumnCount).setNumberFormat("#,##0.00");
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).setNumberFormat("dd mmmm yyyy hh:mm");
  }
}

function getOriginLocation_() {
  const cache = PropertiesService.getScriptProperties();
  const cached = cache.getProperty("ORIGIN_LOCATION");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.query) return parsed;
    } catch (error) {
      cache.deleteProperty("ORIGIN_LOCATION");
    }
  }
  const origin = parseLocationInput_(ORIGIN_MAPS_URL);
  cache.setProperty("ORIGIN_LOCATION", JSON.stringify(origin));
  return origin;
}

function parseLocationInput_(input) {
  const original = String(input || "").trim();
  const expanded = isUrl_(original) ? resolveUrl_(original) : original;
  const text = safeDecode_(expanded || original);
  const coordinate = extractCoordinates_(text);
  if (coordinate) {
    return {
      query: coordinate.lat + "," + coordinate.lng,
      label: coordinate.lat + "," + coordinate.lng
    };
  }

  const place = extractPlaceText_(text) || original;
  if (!place) {
    throw new Error("อ่านโลเคชั่นนี้ไม่ได้ กรุณาวางลิงก์ Google Maps หรือชื่อสถานที่");
  }
  return {
    query: place,
    label: place
  };
}

function getAddressParts_(endLocation, destination) {
  const fallback = {
    subdistrict: "",
    district: "",
    province: "",
    formattedAddress: destination.label || ""
  };
  try {
    const geocoder = Maps.newGeocoder().setLanguage("th");
    const response = endLocation && endLocation.lat && endLocation.lng
      ? geocoder.reverseGeocode(Number(endLocation.lat), Number(endLocation.lng))
      : geocoder.geocode(destination.query);
    const result = response && response.results && response.results[0];
    if (!result) return fallback;
    const components = result.address_components || [];
    return {
      subdistrict: cleanThaiAreaName_(pickAddressComponent_(components, [
        "sublocality_level_2",
        "sublocality_level_1",
        "administrative_area_level_3",
        "locality"
      ])),
      district: cleanThaiAreaName_(pickAddressComponent_(components, [
        "administrative_area_level_2",
        "sublocality_level_1",
        "locality"
      ])),
      province: cleanThaiAreaName_(pickAddressComponent_(components, [
        "administrative_area_level_1"
      ])),
      formattedAddress: result.formatted_address || destination.label || ""
    };
  } catch (error) {
    return fallback;
  }
}

function pickAddressComponent_(components, targetTypes) {
  for (let targetIndex = 0; targetIndex < targetTypes.length; targetIndex += 1) {
    const target = targetTypes[targetIndex];
    const matched = (components || []).find((component) => {
      return component.types && component.types.indexOf(target) >= 0;
    });
    if (matched) return matched.long_name || matched.short_name || "";
  }
  return "";
}

function cleanThaiAreaName_(value) {
  return String(value || "")
    .replace(/^ตำบล\s*/i, "")
    .replace(/^ต\.\s*/i, "")
    .replace(/^แขวง\s*/i, "")
    .replace(/^อำเภอ\s*/i, "")
    .replace(/^อ\.\s*/i, "")
    .replace(/^เขต\s*/i, "")
    .replace(/^จังหวัด\s*/i, "")
    .replace(/^จ\.\s*/i, "")
    .trim();
}

function resolveUrl_(url) {
  let current = String(url || "").trim();
  for (let index = 0; index < 6; index += 1) {
    const response = UrlFetchApp.fetch(current, {
      followRedirects: false,
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    const headers = response.getHeaders();
    const location = headers.Location || headers.location;
    if (!location) return current;
    current = absolutizeUrl_(current, location);
  }
  return current;
}

function absolutizeUrl_(base, location) {
  const target = String(location || "").trim();
  if (/^https?:\/\//i.test(target)) return target;
  const match = String(base || "").match(/^(https?:\/\/[^\/]+)/i);
  return match ? match[1] + (target.charAt(0) === "/" ? target : "/" + target) : target;
}

function extractCoordinates_(text) {
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /(-?\d+\.\d+),\s*(-?\d+\.\d+)/
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = String(text || "").match(patterns[index]);
    if (match) {
      return { lat: match[1], lng: match[2] };
    }
  }
  return null;
}

function extractPlaceText_(text) {
  const placeMatch = String(text || "").match(/\/maps\/place\/([^\/?@]+)/);
  if (placeMatch) {
    return placeMatch[1].replace(/\+/g, " ");
  }
  const queryMatch = String(text || "").match(/[?&](?:q|query)=([^&]+)/);
  if (queryMatch) {
    return queryMatch[1].replace(/\+/g, " ");
  }
  return String(text || "").replace(/^https?:\/\//, "").trim();
}

function safeDecode_(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (error) {
    return String(value || "");
  }
}

function isUrl_(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function roundDistance_(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function formatDuration_(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);
  if (hours <= 0) return minutes + " นาที";
  return hours + " ชม. " + minutes + " นาที";
}

function parseNumber_(value) {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  const cleaned = String(value || "")
    .replace(/[,\s฿]/g, "")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return isFinite(parsed) ? parsed : 0;
}

function roundMoney_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeDepositRates_(rates) {
  const data = rates || {};
  return {
    first: parseNumber_(data.first) || 0,
    second: parseNumber_(data.second) || 0,
    final: parseNumber_(data.final) || 0
  };
}

function roundTravelCost_(value) {
  const amount = Number(value) || 0;
  if (amount <= 0) return 0;
  return Math.ceil(amount / 1000) * 1000;
}
