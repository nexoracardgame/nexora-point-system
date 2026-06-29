export const CARD_RARE_CODE_PATTERN =
  /NXR-RARE-\d{3}-\d{10,}-[A-Z0-9]{4,16}/i;

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function buildCardRareCode(cardNo: string) {
  const safeCardNo = String(cardNo || "").replace(/\D/g, "").padStart(3, "0");
  return `NXR-RARE-${safeCardNo}-${Date.now()}-${randomSuffix()}`;
}

export function extractCardRareCode(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const candidates = new Set<string>([raw]);

  try {
    candidates.add(decodeURIComponent(raw));
  } catch {}

  for (const candidate of Array.from(candidates)) {
    try {
      const url = new URL(candidate);
      candidates.add(url.pathname);
      candidates.add(url.search);

      for (const key of ["code", "coupon", "open", "cardRare"]) {
        const param = url.searchParams.get(key);
        if (param) candidates.add(param);
      }

      url.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => candidates.add(part));
    } catch {}
  }

  for (const candidate of candidates) {
    const match = candidate.toUpperCase().match(CARD_RARE_CODE_PATTERN);
    if (match?.[0]) return match[0];
  }

  return "";
}
