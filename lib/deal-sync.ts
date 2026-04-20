export const DEAL_SYNC_EVENT = "nexora:deal-updated";

export type DealSyncDetail = {
  dealId?: string | null;
  action?:
    | "created"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "completed"
    | "refresh";
  timestamp?: number;
};

export function emitDealSync(detail: DealSyncDetail) {
  if (typeof window === "undefined") return;

  const payload: DealSyncDetail = {
    ...detail,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<DealSyncDetail>(DEAL_SYNC_EVENT, {
      detail: payload,
    })
  );

  try {
    window.localStorage.setItem(DEAL_SYNC_EVENT, JSON.stringify(payload));
  } catch {}
}

export function listenDealSync(listener: (detail: DealSyncDetail) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onDealSync = (event: Event) => {
    listener((event as CustomEvent<DealSyncDetail>).detail || {});
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== DEAL_SYNC_EVENT || !event.newValue) return;

    try {
      listener(JSON.parse(event.newValue) as DealSyncDetail);
    } catch {}
  };

  window.addEventListener(DEAL_SYNC_EVENT, onDealSync as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(DEAL_SYNC_EVENT, onDealSync as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
