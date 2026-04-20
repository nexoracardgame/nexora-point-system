export type DealRealtimeAction =
  | "created"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed"
  | "refresh";

export type DealRealtimeEvent = {
  dealId?: string | null;
  action?: DealRealtimeAction;
  changedAt?: string;
  timestamp?: number;
};

type DealEventListener = (event: DealRealtimeEvent) => void;

const globalForDealEvents = globalThis as typeof globalThis & {
  __nexoraDealListeners?: Set<DealEventListener>;
};

function getDealListeners() {
  globalForDealEvents.__nexoraDealListeners ??= new Set<DealEventListener>();
  return globalForDealEvents.__nexoraDealListeners;
}

export function publishDealEvent(event: DealRealtimeEvent) {
  const payload: DealRealtimeEvent = {
    ...event,
    changedAt: event.changedAt || new Date().toISOString(),
    timestamp: Date.now(),
  };

  for (const listener of getDealListeners()) {
    try {
      listener(payload);
    } catch {}
  }
}

export function subscribeDealEvents(listener: DealEventListener) {
  const listeners = getDealListeners();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
