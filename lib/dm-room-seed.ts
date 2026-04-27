export type DmRoomSeed = {
  otherUserId?: string;
  name?: string;
  image?: string;
};

function buildKey(roomId: string) {
  return `nexora_dm_room_seed:${roomId}`;
}

export function saveDmRoomSeed(roomId: string, seed: DmRoomSeed) {
  if (typeof window === "undefined" || !roomId) return;

  try {
    window.sessionStorage.setItem(buildKey(roomId), JSON.stringify(seed));
  } catch {
    return;
  }
}

export function readDmRoomSeed(roomId: string): DmRoomSeed | null {
  if (typeof window === "undefined" || !roomId) return null;

  try {
    const raw = window.sessionStorage.getItem(buildKey(roomId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DmRoomSeed;
    return parsed && (parsed.name || parsed.image) ? parsed : null;
  } catch {
    return null;
  }
}
