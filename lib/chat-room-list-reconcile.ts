type Room = { key: string; lastMessageAt?: string; createdAt: string };

export function reconcileRoomList<T extends Room>(current: T[], incoming: T[], baseline: T[]): T[] {
  const before = new Map(baseline.map((room) => [room.key, room]));
  const live = new Map(current.map((room) => [room.key, room]));
  const time = (room: T) => Date.parse(room.lastMessageAt || room.createdAt) || 0;
  const result = incoming.map((room) => {
    const existing = live.get(room.key);
    // An in-flight snapshot cannot replace a newer realtime or optimistic preview.
    return existing && time(existing) > time(room) ? existing : room;
  });
  const keys = new Set(result.map((room) => room.key));
  for (const room of current) {
    if (!keys.has(room.key) && before.get(room.key) !== room) result.push(room);
  }
  return result.sort((a, b) => time(b) - time(a) || a.key.localeCompare(b.key));
}
