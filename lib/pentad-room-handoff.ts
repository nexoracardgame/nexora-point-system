import type { PentadRoom } from './pentad-room-store';
const key = 'nexora:pentad:handoff';
export function clearPentadHandoff() { try { sessionStorage.removeItem(key); } catch { /* Optional navigation cache. */ } }
export function savePentadHandoff(owner: string, room: PentadRoom) {
  try { sessionStorage.setItem(key, JSON.stringify({ owner, room, at: Date.now() })); } catch { /* Navigation remains available. */ }
}
export function readPentadHandoff(owner: string, code: string): PentadRoom | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!value || value.owner !== owner || value.room?.code !== code || Date.now()-value.at > 15000 || Date.now()<value.at) return null;
    const room = value.room as PentadRoom;
    if (![room.seats.host,room.seats.challenger,...room.spectators].some(person=>person?.id===owner)) return null;
    sessionStorage.removeItem(key);
    return room;
  } catch { return null; }
}
