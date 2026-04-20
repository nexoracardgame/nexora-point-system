export const MARKET_SYNC_EVENT = "nexora:market-listing-updated";

export type MarketSyncDetail = {
  listingId?: string | null;
  action?: "created" | "updated" | "deleted" | "refresh";
  timestamp?: number;
};

export function emitMarketSync(detail: MarketSyncDetail) {
  if (typeof window === "undefined") return;

  const payload: MarketSyncDetail = {
    ...detail,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<MarketSyncDetail>(MARKET_SYNC_EVENT, {
      detail: payload,
    })
  );

  try {
    window.localStorage.setItem(MARKET_SYNC_EVENT, JSON.stringify(payload));
  } catch {}
}

export function listenMarketSync(
  listener: (detail: MarketSyncDetail) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onMarketSync = (event: Event) => {
    listener((event as CustomEvent<MarketSyncDetail>).detail || {});
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== MARKET_SYNC_EVENT || !event.newValue) return;

    try {
      listener(JSON.parse(event.newValue) as MarketSyncDetail);
    } catch {}
  };

  window.addEventListener(MARKET_SYNC_EVENT, onMarketSync as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(MARKET_SYNC_EVENT, onMarketSync as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
