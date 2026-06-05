import { EventEmitter } from "events";

export type CardBankRealtimeEvent = {
  ownerId: string;
  assetId?: string;
  action: "deposit" | "withdraw";
  version: string;
};

type CardBankRealtimeBus = EventEmitter & {
  latestVersionByOwner?: Map<string, string>;
};

const globalKey = "__nexoraCardBankRealtimeBus";

function getBus() {
  const globalScope = globalThis as typeof globalThis & {
    [globalKey]?: CardBankRealtimeBus;
  };

  if (!globalScope[globalKey]) {
    const bus = new EventEmitter() as CardBankRealtimeBus;
    bus.setMaxListeners(500);
    bus.latestVersionByOwner = new Map();
    globalScope[globalKey] = bus;
  }

  return globalScope[globalKey];
}

function createVersion() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getCardBankOwnerVersion(ownerId: string) {
  const safeOwnerId = String(ownerId || "").trim();
  if (!safeOwnerId) return "";
  return getBus().latestVersionByOwner?.get(safeOwnerId) || "";
}

export function publishCardBankEvent(
  event: Omit<CardBankRealtimeEvent, "version">
) {
  const safeOwnerId = String(event.ownerId || "").trim();
  if (!safeOwnerId) return null;

  const payload: CardBankRealtimeEvent = {
    ...event,
    ownerId: safeOwnerId,
    version: createVersion(),
  };
  const bus = getBus();
  bus.latestVersionByOwner?.set(safeOwnerId, payload.version);
  bus.emit(`owner:${safeOwnerId}`, payload);
  return payload;
}

export function subscribeCardBankOwner(
  ownerId: string,
  listener: (event: CardBankRealtimeEvent) => void
) {
  const safeOwnerId = String(ownerId || "").trim();
  if (!safeOwnerId) return () => {};

  const bus = getBus();
  const eventName = `owner:${safeOwnerId}`;
  bus.on(eventName, listener);
  return () => bus.off(eventName, listener);
}
