export const LIVE_REALTIME_CHANNEL = "nexora-live-status";
export const LIVE_REALTIME_EVENT = "live-status";

export type LiveRealtimeAction =
  | "started"
  | "ended"
  | "banned"
  | "unbanned"
  | "changed";

export type LiveRealtimePayload = {
  action?: LiveRealtimeAction;
  liveId?: string;
  ownerUserId?: string;
  active?: unknown;
  refresh?: boolean;
  at?: number;
};
