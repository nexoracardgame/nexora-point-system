export const TRIAD_ROOM_REALTIME_CHANNEL = "triad-dominion-rooms";
export const TRIAD_ROOM_REALTIME_EVENT = "room-changed";

export type TriadRoomRealtimePayload = {
  action?: string;
  code?: string;
  room?: unknown;
  deleted?: boolean;
  refresh?: boolean;
  at?: number;
};
