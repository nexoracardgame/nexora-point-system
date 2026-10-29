import type { PublicTriadRoom } from "./triad-room-store";

export function triadRoomForViewer(room: PublicTriadRoom, userId: string): PublicTriadRoom {
  const copy = structuredClone(room);
  const own = room.seats.host?.id === userId ? "host" : room.seats.challenger?.id === userId ? "challenger" : "";
  const lanes = ["top", "left", "right"] as const;
  const currentLane = lanes[room.game.activeTurn - 1];
  const bothLocked = Boolean(room.game.triangles.host[currentLane] && room.game.triangles.challenger[currentLane]);
  for (const side of ["host", "challenger"] as const) {
    if (side === own) continue;
    copy.game.decks[side] = Array(room.game.decks[side].length).fill("");
    copy.game.selectionPools[side] = [];
    const concealed = new Set<string>();
    for (const choice of room.game.skillChoices) {
      if (choice.side === side && !room.game.turns.some(turn => turn.turn === choice.turn) && choice.blessingDrawCardNo) concealed.add(choice.blessingDrawCardNo);
    }
    for (const [index, lane] of lanes.entries()) {
      const revealed = room.game.turns.some(turn => turn.turn === index + 1) || (index + 1 === room.game.activeTurn && bothLocked);
      if (!revealed && copy.game.triangles[side][lane]) {
        concealed.add(copy.game.triangles[side][lane]);
        copy.game.triangles[side][lane] = "hidden";
      }
    }
    copy.game.usedCards[side] = room.game.usedCards[side].filter(no => !concealed.has(no));
  }
  copy.game.skillChoices = copy.game.skillChoices.map(choice => choice.side === own || room.game.turns.some(turn => turn.turn === choice.turn)
    ? choice : { ...choice, cardNo: choice.turn === room.game.activeTurn && !bothLocked ? "hidden" : choice.cardNo, selectedTarget: choice.selectedTarget ? "confirmed" : "", previewTarget:choice.turn===room.game.activeTurn&&bothLocked?choice.previewTarget:undefined, blessingDrawCardNo: undefined, blessingPreviewTopNo: undefined });
  if (copy.game.openerTieBreak.status === "waiting") {
    for (const side of ["host", "challenger"] as const) if (side !== own) delete copy.game.openerTieBreak.choices[side];
  }
  return copy;
}

export function triadResponseForViewer<T>(body: T, userId: string): T {
  if (!body || typeof body !== "object") return body;
  const value = body as Record<string, unknown>;
  return { ...value,
    ...(value.room ? { room: triadRoomForViewer(value.room as PublicTriadRoom, userId) } : {}),
    ...(Array.isArray(value.rooms) ? { rooms: value.rooms.map(room => triadRoomForViewer(room, userId)) } : {}),
  } as T;
}
