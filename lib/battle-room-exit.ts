// Departure must survive route unmount without applying stale room snapshots.
export async function sendBattleRoomExit(endpoint: string, body: Record<string, unknown>) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ ...body, action: 'leave' }),
      });
      if (response.ok) return true;
      if (response.status < 500) return false;
    } catch { /* Retry a transport failure once without blocking navigation. */ }
  }
  return false;
}
