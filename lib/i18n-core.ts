export type Locale = "th" | "en";

export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_COOKIE_KEY = "nexora_locale";

type TranslationValue = string | ((vars?: Record<string, string | number>) => string);

export const translations = {
  th: {
    "layout.command": "ศูนย์ควบคุม NEXORA",
    "layout.page.home": "หน้าหลัก NEXORA",
    "layout.page.market": "ตลาด",
    "layout.page.collections": "คอลเลกชัน",
    "layout.page.community": "ชุมชน",
    "layout.page.redeem": "แลกของรางวัล",
    "layout.page.rewards": "รางวัล",
    "layout.page.wallet": "กระเป๋า",
    "layout.page.dashboard": "แดชบอร์ด",
    "layout.nav.home": "หน้าหลัก",
    "layout.nav.market": "ตลาด",
    "layout.nav.rewards": "รางวัล",
    "layout.nav.redeem": "แลกของ",
    "layout.nav.collections": "คอลเลกชัน",
    "layout.nav.community": "ชุมชน",
    "layout.nav.chat": "แชท",
    "layout.nav.wallet": "กระเป๋า",
    "layout.nav.profile": "โปรไฟล์ฉัน",
    "layout.nav.profileSettings": "ตั้งค่าโปรไฟล์",
    "layout.profile.commander": "ผู้บัญชาการ",
    "layout.logout": "ออกจากระบบ",
    "layout.mobile.menu": "เมนูหลัก",
    "layout.lang.th": "ไทย",
    "layout.lang.en": "English",
    "layout.lang.switch": "ภาษา",

    "notifications.center": "ศูนย์แจ้งเตือน",
    "notifications.recent": "รายการล่าสุด",
    "notifications.new": ({ count }) => `${count} ใหม่`,
    "notifications.loading": "กำลังโหลดการแจ้งเตือน...",
    "notifications.empty": "ยังไม่มีการแจ้งเตือน",
    "notifications.justNow": "เมื่อสักครู่",
    "notifications.minutes": ({ count }) => `${count} นาที`,
    "notifications.hours": ({ count }) => `${count} ชม.`,
    "notifications.days": ({ count }) => `${count} วัน`,

    "deals.title": "คำขอดีล",
    "deals.pending": "รอดำเนินการ",
    "deals.ready": "พร้อมปิดดีล",
    "deals.refreshing": "กำลังอัปเดตดีล...",
    "deals.autoRefresh": "ดีลจะรีเฟรชอัตโนมัติเมื่อกลับมาที่หน้านี้และทุก 15 วินาที",
    "deals.section.ready": "พร้อมปิดดีล",
    "deals.section.pending": "คำขอที่รออยู่",
    "deals.empty": "ตอนนี้ยังไม่มีดีลที่รออยู่",
    "deals.loading": "กำลังโหลดดีล...",
    "deals.status.ready": "พร้อมปิดดีล",
    "deals.status.rejected": "ถูกปฏิเสธ",
    "deals.status.pending": "รอดำเนินการ",
    "deals.role.waitBuyer": "รอผู้ซื้อยืนยัน",
    "deals.role.verify": "พร้อมยืนยันปิดดีล",
    "deals.role.ownerAction": "รอเจ้าของตัดสินใจ",
    "deals.role.yourRequest": "คำขอของคุณ",
    "deals.offerPrice": "ราคาที่เสนอ",
    "deals.chat": "แชทนัดสถานที่",
    "deals.chatOpening": "กำลังเปิดแชท...",
    "deals.card": "การ์ด",
    "deals.buyer": "ผู้ซื้อ",
    "deals.seller": "ผู้ขาย",
    "deals.ownerAction": "เจ้าของต้องตัดสินใจ",
    "deals.activeRequest": "คำขอของคุณที่ยังใช้งานอยู่",
    "deals.acceptedWait": "ดีลตกลงแล้ว - รอผู้ซื้อยืนยัน",
    "deals.acceptedDesc":
      "นัดเจอ ตรวจการ์ดจริง แล้วให้ผู้ซื้อกรอก serial จากการ์ดจริงเพื่อปิดการขาย",
    "deals.closeReady": "พร้อมปิดการขาย",
    "deals.cancelAccepted": "ยกเลิกดีลนี้",
    "deals.cancelRequest": "ยกเลิกคำขอนี้",
    "deals.cancelLoading": "กำลังยกเลิก...",
    "deals.accept": "Accept",
    "deals.reject": "Reject",
    "deals.verify": "ยืนยัน Serial และปิดการขาย",
    "deals.request": "ขอดีล",
    "deals.requestLoading": "กำลังส่ง...",
    "deals.requestPricePrompt": "ใส่ราคาที่ต้องการขอดีล (บาท)",
    "deals.requestInvalidPrice": "กรุณาใส่ราคาที่ถูกต้อง",

    "market.card.header": "NEXORA MARKET / รายละเอียดการ์ด",
    "market.card.currentOwner": "เจ้าของปัจจุบัน",
    "market.card.currentSeller": "ผู้ขายปัจจุบัน",
    "market.card.openOffers": "ข้อเสนอที่เปิดอยู่",
    "market.card.marketSignal": "สัญญาณราคาตลาด",
    "market.card.low": "ต่ำสุด",
    "market.card.fairPrice": "ราคากลาง",
    "market.card.high": "สูงสุด",
    "market.card.notEnoughHistory": "ยังมีข้อมูลราคาไม่พอ",
    "market.card.completedDeals": ({ count, cardNo }) =>
      `อิงจากดีลที่ปิดจริง ${count} รายการของการ์ด No.${cardNo}`,
    "market.card.askingPrices": ({ count, cardNo }) =>
      `อิงจากราคาตั้งขาย ${count} รายการของการ์ด No.${cardNo}`,
    "market.card.medianHint": "ตัวเลขกลางใช้ median เพื่อกันโพสต์ราคาเวอร์ลากค่าเฉลี่ยขึ้น",
    "market.card.timeline": "ไทม์ไลน์การครอบครอง",
    "market.card.noHistory": "ยังไม่มีประวัติการครอบครอง",
    "market.card.recentOffers": "ข้อเสนอล่าสุด",
    "market.card.noOffers": "ยังไม่มีการเคลื่อนไหวของข้อเสนอ",
    "market.card.rarityShare": "สัดส่วนความหายากในตลาด",
    "market.card.rarityDesc": ({ rarity, same, total }) =>
      `${rarity} มีอยู่ ${same} จาก ${total} รายการที่เปิดขายอยู่ในตลาด`,
    "market.card.rarityHint": "ค่านี้ใช้สัดส่วนรายการที่เปิดขายจริง ไม่ใช่ drop rate ปลอม",
    "market.card.listedToday": "ลงขายวันนี้",
    "market.card.listedOneDay": "ลงขายมาแล้ว 1 วัน",
    "market.card.listedDays": ({ count }) => `ลงขายมาแล้ว ${count} วัน`,
    "market.card.unknownUser": "ผู้ใช้ไม่ทราบชื่อ",
    "market.card.completedSale": ({ seller, price }) =>
      `${seller} ปิดการขายแล้ว${price ? ` ที่ ${price}` : ""}`,
    "market.card.acceptedOffer": ({ seller, price }) =>
      `${seller} ตกลงรับข้อเสนอ${price ? ` ที่ ${price}` : ""}`,
    "market.card.updatedListing": ({ seller }) => `${seller} อัปเดตรายการนี้`,
  },
  en: {
    "layout.command": "NEXORA COMMAND",
    "layout.page.home": "NEXORA HOME",
    "layout.page.market": "MARKET",
    "layout.page.collections": "COLLECTIONS",
    "layout.page.community": "COMMUNITY",
    "layout.page.redeem": "REDEEM",
    "layout.page.rewards": "REWARDS",
    "layout.page.wallet": "WALLET",
    "layout.page.dashboard": "DASHBOARD",
    "layout.nav.home": "Home",
    "layout.nav.market": "Market",
    "layout.nav.rewards": "Rewards",
    "layout.nav.redeem": "Redeem",
    "layout.nav.collections": "Collections",
    "layout.nav.community": "Community",
    "layout.nav.chat": "Chat",
    "layout.nav.wallet": "Wallet",
    "layout.nav.profile": "My Profile",
    "layout.nav.profileSettings": "Profile Settings",
    "layout.profile.commander": "Commander",
    "layout.logout": "Logout",
    "layout.mobile.menu": "COMMAND MENU",
    "layout.lang.th": "Thai",
    "layout.lang.en": "English",
    "layout.lang.switch": "Language",

    "notifications.center": "Notification Center",
    "notifications.recent": "Recent Alerts",
    "notifications.new": ({ count }) => `${count} new`,
    "notifications.loading": "Loading notifications...",
    "notifications.empty": "No notifications yet",
    "notifications.justNow": "Just now",
    "notifications.minutes": ({ count }) => `${count}m`,
    "notifications.hours": ({ count }) => `${count}h`,
    "notifications.days": ({ count }) => `${count}d`,

    "deals.title": "Deal Requests",
    "deals.pending": "Pending",
    "deals.ready": "Ready",
    "deals.refreshing": "Refreshing deals...",
    "deals.autoRefresh": "Deals auto-refresh when you return to this page and every 15 seconds.",
    "deals.section.ready": "Ready to Close",
    "deals.section.pending": "Pending Requests",
    "deals.empty": "No pending deals right now",
    "deals.loading": "Loading deals...",
    "deals.status.ready": "READY TO CLOSE",
    "deals.status.rejected": "REJECTED",
    "deals.status.pending": "PENDING",
    "deals.role.waitBuyer": "WAITING BUYER VERIFY",
    "deals.role.verify": "VERIFY TO CLOSE",
    "deals.role.ownerAction": "OWNER ACTION",
    "deals.role.yourRequest": "YOUR REQUEST",
    "deals.offerPrice": "Offer Price",
    "deals.chat": "Chat to arrange meetup",
    "deals.chatOpening": "Opening chat...",
    "deals.card": "Card",
    "deals.buyer": "Buyer",
    "deals.seller": "Seller",
    "deals.ownerAction": "OWNER ACTION REQUIRED",
    "deals.activeRequest": "YOUR ACTIVE REQUEST",
    "deals.acceptedWait": "DEAL ACCEPTED - WAITING BUYER VERIFY",
    "deals.acceptedDesc":
      "Meet in person, inspect the real card, then let the buyer verify the serial to close the sale.",
    "deals.closeReady": "READY TO CLOSE SALE",
    "deals.cancelAccepted": "Cancel This Deal",
    "deals.cancelRequest": "Cancel My Request",
    "deals.cancelLoading": "Cancelling...",
    "deals.accept": "Accept",
    "deals.reject": "Reject",
    "deals.verify": "Verify Serial & Close Sale",
    "deals.request": "Request Deal",
    "deals.requestLoading": "Sending...",
    "deals.requestPricePrompt": "Enter your deal price (THB)",
    "deals.requestInvalidPrice": "Please enter a valid price",

    "market.card.header": "NEXORA MARKET / CARD DETAIL",
    "market.card.currentOwner": "Current Owner",
    "market.card.currentSeller": "Current Seller",
    "market.card.openOffers": "Open Offers",
    "market.card.marketSignal": "Market Price Signal",
    "market.card.low": "Low",
    "market.card.fairPrice": "Fair Price",
    "market.card.high": "High",
    "market.card.notEnoughHistory": "Not enough market history yet",
    "market.card.completedDeals": ({ count, cardNo }) =>
      `Based on ${count} completed deals for card No.${cardNo}`,
    "market.card.askingPrices": ({ count, cardNo }) =>
      `Based on ${count} asking-price records for card No.${cardNo}`,
    "market.card.medianHint":
      "The middle number uses median, so one overpriced listing cannot inflate it easily.",
    "market.card.timeline": "Ownership Timeline",
    "market.card.noHistory": "No ownership history has been recorded yet",
    "market.card.recentOffers": "Recent Offers",
    "market.card.noOffers": "No offer activity yet",
    "market.card.rarityShare": "Rarity Market Share",
    "market.card.rarityDesc": ({ rarity, same, total }) =>
      `${rarity} appears in ${same} of ${total} active market listings`,
    "market.card.rarityHint":
      "This uses real active listings in the market instead of a fake drop rate.",
    "market.card.listedToday": "Listed today",
    "market.card.listedOneDay": "Listed 1 day ago",
    "market.card.listedDays": ({ count }) => `Listed ${count} days ago`,
    "market.card.unknownUser": "Unknown User",
    "market.card.completedSale": ({ seller, price }) =>
      `${seller} completed a sale${price ? ` at ${price}` : ""}`,
    "market.card.acceptedOffer": ({ seller, price }) =>
      `${seller} accepted an offer${price ? ` at ${price}` : ""}`,
    "market.card.updatedListing": ({ seller }) => `${seller} updated this listing`,
  },
} satisfies Record<Locale, Record<string, TranslationValue>>;

export function resolveLocale(locale?: string | null): Locale {
  return locale === "en" ? "en" : "th";
}

export function getLocaleTag(locale: Locale) {
  return locale === "th" ? "th-TH" : "en-US";
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
) {
  const table = translations[locale] ?? translations[DEFAULT_LOCALE];
  const value = table[key] ?? translations[DEFAULT_LOCALE][key] ?? key;

  if (typeof value === "function") {
    return value(vars);
  }

  return value;
}
