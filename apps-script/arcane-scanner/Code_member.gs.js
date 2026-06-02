/* -----------------------
   Helpers
----------------------- */
function normalize_(v) {
  return (v ?? "")
    .toString()
    .trim()
    .replace(/\u200B/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

// ✅ แปลงลิงก์ Google Drive (/view) → ลิงก์รูปตรง (มือถือไม่เด้ง Drive)
function toDirectDriveImageUrl_(url) {
  url = (url || "").toString().trim();
  if (!url) return "";

  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return "https://drive.google.com/uc?export=view&id=" + m[1];

  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return "https://drive.google.com/uc?export=view&id=" + m[1];

  if (url.includes("drive.google.com/uc?export=view&id=")) return url;

  return url;
}

// ✅ สร้าง map หัวตาราง -> index (กันคอลัมน์เลื่อน)
function headerIndexMap_(headersRow){
  const headers = headersRow.map(h => String(h ?? "").trim().toLowerCase());

  const pick = (...names) => {
    for (const n of names){
      const i = headers.indexOf(String(n).trim().toLowerCase());
      if (i !== -1) return i;
    }
    return -1;
  };

  return {
    member:  pick("member","รหัสสมาชิก"),
    nickname:pick("nickname","ชื่อเล่น"),
    phone:   pick("phone","เบอร์โทร"),
    line:    pick("line","ไลน์"),
    sales:   pick("ยอดขาย","sales","ยอดขายรวม"),     // ✅ เพิ่ม
    rank:    pick("rank"),
    expiry:  pick("expiry","วันหมดอายุบัตร","วันหมดอายุ"),
    status:  pick("status","สถานะ"),
    bgImage: pick("bg_image","bg image","bgimage")
  };
}

function increaseCounter(){
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(8000);

  try{
    const n = Number(props.getProperty("PAGE_VIEW_TOTAL") || 0) + 1;
    props.setProperty("PAGE_VIEW_TOTAL", String(n));
    return n;
  } finally {
    lock.releaseLock();
  }
}

/* -----------------------
   Main
----------------------- */
function checkMember(memberId) {
  const SPREADSHEET_ID = "1AhuWH0gU3J7BHObqwBP0fLXdIDc4ED5A6DcI4TWGRQI";
  const SHEET_NAME = "NEXORA บัตรสมาชิก";

  const input = normalize_(memberId);
  if (!input) return { found: false, note: "กรุณากรอกรหัสสมาชิก" };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    const names = ss.getSheets().map(s => s.getName()).join(", ");
    return { found: false, note: "ไม่พบแท็บชื่อ '" + SHEET_NAME + "'\nแท็บที่มีอยู่: " + names };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { found: false, note: "ชีตยังไม่มีข้อมูล" };

  const idx = headerIndexMap_(data[0]);

  // ถ้าหัวตารางไม่ตรง (กัน error เงียบ)
  if (idx.member === -1) {
    return { found:false, note:"ไม่พบคอลัมน์ 'member' ในหัวตาราง\nตรวจสอบว่าหัวคอลัมน์ชื่อ member หรือ รหัสสมาชิก" };
  }

  const tz = Session.getScriptTimeZone();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const id = normalize_(row[idx.member]); // member
    if (id !== input) continue;

    const nickname = (idx.nickname !== -1 ? row[idx.nickname] : "-");
    const phoneRaw = (idx.phone !== -1 ? row[idx.phone] : "-");
    const lineRaw  = (idx.line !== -1 ? row[idx.line] : "-");
    const salesRaw = (idx.sales !== -1 ? row[idx.sales] : "");     // ✅ ยอดขาย
    const rankRaw  = (idx.rank !== -1 ? row[idx.rank] : "-");
    const bgImageRaw = (idx.bgImage !== -1 ? row[idx.bgImage] : "");
    let status = normalize_(idx.status !== -1 ? row[idx.status] : "") || "INACTIVE";

    // expiry
    const expiryRaw = (idx.expiry !== -1 ? row[idx.expiry] : "");
    let expiryDate = null;

    if (expiryRaw) {
      const d = new Date(expiryRaw);
      if (!isNaN(d.getTime())) {
        expiryDate = d;
        expiryDate.setHours(0, 0, 0, 0);
      }
    }

    let daysLeft = null;
    if (expiryDate) {
      daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) status = "EXPIRED";
    }

    const expiry = expiryDate ? Utilities.formatDate(expiryDate, tz, "dd/MM/yyyy") : "-";

    const isActive = (status === "ACTIVE");
    const phone = isActive ? String(phoneRaw ?? "-").toString().trim() : "-";
    const line  = isActive ? String(lineRaw  ?? "-").toString().trim() : "-";

    // ✅ format ยอดขายให้สวย (ถ้าเป็นตัวเลขจะใส่ comma)
    let salesOut = "";
    if (typeof salesRaw === "number") {
      salesOut = salesRaw.toLocaleString("en-US");
    } else {
      salesOut = String(salesRaw ?? "").trim();
    }

    return {
      found: true,
      member_id: String(row[idx.member] ?? "").toString().trim(),
      nickname: String(nickname ?? "-").toString().trim() || "-",
      phone,
      line,
      sales: salesOut === "" ? "-" : salesOut,          // ✅ ส่ง sales กลับไป
      rank: String(rankRaw ?? "-").toString().trim() || "-",
      status,
      expiry,
      bgImage: toDirectDriveImageUrl_(bgImageRaw),
      daysLeft
    };
  }

  return { found: false, note: "ไม่พบข้อมูลสมาชิก" };
}
