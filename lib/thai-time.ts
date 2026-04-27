const THAI_TIME_ZONE = "Asia/Bangkok";
const DEFAULT_LOCALE = "th-TH";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === "string" || typeof value === "number") {
    const next = new Date(value);
    if (!Number.isNaN(next.getTime())) {
      return next;
    }
  }

  return null;
}

function formatWithOptions(
  value: DateInput,
  locale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
) {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(locale, {
    timeZone: THAI_TIME_ZONE,
    ...options,
  }).format(date);
}

function getThaiDayKey(value: DateInput) {
  const date = toDate(value);
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: THAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

export function formatThaiTime(value: DateInput, locale = DEFAULT_LOCALE) {
  return formatWithOptions(value, locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatThaiDate(value: DateInput, locale = DEFAULT_LOCALE) {
  return formatWithOptions(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatThaiDateTime(value: DateInput, locale = DEFAULT_LOCALE) {
  return formatWithOptions(value, locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatThaiShortDate(value: DateInput, locale = DEFAULT_LOCALE) {
  return formatWithOptions(value, locale, {
    day: "numeric",
    month: "short",
  });
}

export function isSameThaiDay(a: DateInput, b: DateInput) {
  const aKey = getThaiDayKey(a);
  const bKey = getThaiDayKey(b);
  return Boolean(aKey) && aKey === bKey;
}

export function formatThaiRoomTime(value: DateInput, locale = DEFAULT_LOCALE) {
  if (!value) return "";

  if (isSameThaiDay(value, new Date())) {
    return formatThaiTime(value, locale);
  }

  return formatThaiShortDate(value, locale);
}

export function formatThaiTimeAgo(value: DateInput) {
  const date = toDate(value);
  if (!date) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "เมื่อสักครู่";
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;

  return formatThaiDateTime(date);
}
