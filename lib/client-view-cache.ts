type ClientViewCacheEntry<T> = {
  data: T;
  cachedAt: number;
};

const memoryCache = new Map<string, ClientViewCacheEntry<unknown>>();

function buildStorageKey(key: string) {
  return `nexora:view:${String(key || "").trim()}`;
}

export function readClientViewCache<T>(
  key: string,
  options?: { maxAgeMs?: number }
): ClientViewCacheEntry<T> | null {
  const safeKey = String(key || "").trim();
  if (!safeKey) {
    return null;
  }

  const maxAgeMs = Math.max(1, Number(options?.maxAgeMs || 180000));
  const now = Date.now();
  const memoryEntry = memoryCache.get(safeKey) as
    | ClientViewCacheEntry<T>
    | undefined;

  if (memoryEntry && now - memoryEntry.cachedAt <= maxAgeMs) {
    return memoryEntry;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(buildStorageKey(safeKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ClientViewCacheEntry<T> | null;
    if (!parsed || typeof parsed.cachedAt !== "number") {
      return null;
    }

    if (now - parsed.cachedAt > maxAgeMs) {
      window.sessionStorage.removeItem(buildStorageKey(safeKey));
      return null;
    }

    memoryCache.set(safeKey, parsed as ClientViewCacheEntry<unknown>);
    return parsed;
  } catch {
    return null;
  }
}

export function writeClientViewCache<T>(key: string, data: T) {
  const safeKey = String(key || "").trim();
  if (!safeKey) {
    return;
  }

  const entry: ClientViewCacheEntry<T> = {
    data,
    cachedAt: Date.now(),
  };

  memoryCache.set(safeKey, entry as ClientViewCacheEntry<unknown>);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      buildStorageKey(safeKey),
      JSON.stringify(entry)
    );
  } catch {
    return;
  }
}
