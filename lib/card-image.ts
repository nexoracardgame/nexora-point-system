const CARD_IMAGE_EXTENSIONS = ["jpg", "png", "jpeg", "webp"] as const;

export function normalizeCardAssetNo(value: unknown) {
  return String(value || "").trim().padStart(3, "0");
}

export function buildLocalCardImage(
  cardNo: unknown,
  ext: (typeof CARD_IMAGE_EXTENSIONS)[number] = "jpg"
) {
  return `/cards/${normalizeCardAssetNo(cardNo)}.${ext}`;
}

export function buildLocalCardImageCandidates(cardNo: unknown) {
  const normalized = normalizeCardAssetNo(cardNo);
  if (!normalized || normalized === "000") return [];

  return CARD_IMAGE_EXTENSIONS.map((ext) => `/cards/${normalized}.${ext}`);
}

export function sanitizeCardImageUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || /^(null|undefined|false)$/i.test(raw)) {
    return null;
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function resolveCardDisplayImage(cardNo: unknown, imageUrl: unknown) {
  return sanitizeCardImageUrl(imageUrl) || buildLocalCardImage(cardNo);
}
