export type TriadRoomAccess = "public" | "private";
export type TriadRoomStatus = "waiting" | "playing";
export type TriadRoomSlot = "host" | "challenger";

export type TriadRoomParticipant = {
  id: string;
  name: string;
  image: string;
  joinedAt: number;
};

export type StoredTriadRoom = {
  code: string;
  access: TriadRoomAccess;
  password: string;
  status: TriadRoomStatus;
  hostId: string;
  createdAt: number;
  seats: {
    host: TriadRoomParticipant | null;
    challenger: TriadRoomParticipant | null;
  };
  spectators: TriadRoomParticipant[];
};

export type PublicTriadRoom = Omit<StoredTriadRoom, "password"> & {
  hasPassword: boolean;
};

const SPECTATOR_LIMIT = 10;

const globalForTriadRooms = globalThis as {
  nexoraTriadRooms?: StoredTriadRoom[];
};

function rooms() {
  if (!globalForTriadRooms.nexoraTriadRooms) {
    globalForTriadRooms.nexoraTriadRooms = [];
  }
  return globalForTriadRooms.nexoraTriadRooms;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function roomCode(existing: StoredTriadRoom[]) {
  const used = new Set(existing.map((room) => room.code));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

function publicRoom(room: StoredTriadRoom): PublicTriadRoom {
  const { password, ...rest } = room;
  return {
    ...rest,
    hasPassword: Boolean(password),
  };
}

function removeParticipant(room: StoredTriadRoom, participantId: string): StoredTriadRoom {
  return {
    ...room,
    seats: {
      host: room.seats.host?.id === participantId ? null : room.seats.host,
      challenger: room.seats.challenger?.id === participantId ? null : room.seats.challenger,
    },
    spectators: room.spectators.filter((viewer) => viewer.id !== participantId),
  };
}

function upsertRoom(nextRoom: StoredTriadRoom | null) {
  const current = rooms();
  if (!nextRoom) return;
  const index = current.findIndex((room) => room.code === nextRoom.code);
  if (index >= 0) current[index] = nextRoom;
  else current.push(nextRoom);
}

function deleteRoom(code: string) {
  globalForTriadRooms.nexoraTriadRooms = rooms().filter((room) => room.code !== code);
}

function compactEmptyRooms() {
  globalForTriadRooms.nexoraTriadRooms = rooms()
    .filter((room) => room.seats.host || room.seats.challenger || room.spectators.length > 0)
    .slice(-50);
}

export function listTriadRooms() {
  compactEmptyRooms();
  return rooms()
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicRoom);
}

export function createTriadRoom(input: {
  access: TriadRoomAccess;
  password?: string;
  participant: TriadRoomParticipant;
}) {
  const current = rooms();
  const code = roomCode(current);
  const room: StoredTriadRoom = {
    code,
    access: input.access,
    password: input.access === "private" ? cleanText(input.password) : "",
    status: "waiting",
    hostId: input.participant.id,
    createdAt: Date.now(),
    seats: {
      host: input.participant,
      challenger: null,
    },
    spectators: [],
  };

  current.push(room);
  compactEmptyRooms();
  return publicRoom(room);
}

export function joinTriadRoom(input: {
  code: string;
  password?: string;
  participant: TriadRoomParticipant;
  forceSpectator?: boolean;
}) {
  const room = rooms().find((item) => item.code === cleanText(input.code));
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.access === "private" && room.password !== cleanText(input.password) && room.hostId !== input.participant.id) {
    return { ok: false as const, reason: "wrong_password" as const, room: publicRoom(room) };
  }

  const cleanRoom = removeParticipant(room, input.participant.id);
  const mustSpectate = Boolean(input.forceSpectator || cleanRoom.status === "playing" || cleanRoom.seats.challenger);
  if (mustSpectate) {
    if (cleanRoom.spectators.length >= SPECTATOR_LIMIT) {
      return { ok: false as const, reason: "spectators_full" as const, room: publicRoom(cleanRoom) };
    }
    cleanRoom.spectators = [...cleanRoom.spectators, input.participant].slice(0, SPECTATOR_LIMIT);
  } else if (!cleanRoom.seats.host) {
    cleanRoom.seats.host = input.participant;
  } else {
    cleanRoom.seats.challenger = input.participant;
  }

  upsertRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom), joinedAs: mustSpectate ? "spectator" : "player" };
}

export function moveTriadParticipantToSpectator(code: string, participant: TriadRoomParticipant) {
  const room = rooms().find((item) => item.code === cleanText(code));
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.status === "playing") return { ok: false as const, reason: "already_playing" as const, room: publicRoom(room) };

  const cleanRoom = removeParticipant(room, participant.id);
  if (cleanRoom.spectators.length >= SPECTATOR_LIMIT) {
    return { ok: false as const, reason: "spectators_full" as const, room: publicRoom(cleanRoom) };
  }
  cleanRoom.spectators = [...cleanRoom.spectators, participant];
  upsertRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}

export function takeTriadRoomSlot(code: string, slot: TriadRoomSlot, participant: TriadRoomParticipant) {
  const room = rooms().find((item) => item.code === cleanText(code));
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.status === "playing") return { ok: false as const, reason: "already_playing" as const, room: publicRoom(room) };
  if (room.seats[slot]) return { ok: false as const, reason: "slot_taken" as const, room: publicRoom(room) };

  const cleanRoom = removeParticipant(room, participant.id);
  cleanRoom.seats[slot] = participant;
  upsertRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}

export function startTriadRoom(code: string, participantId: string) {
  const room = rooms().find((item) => item.code === cleanText(code));
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.hostId !== participantId) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  if (!room.seats.host || !room.seats.challenger) {
    return { ok: false as const, reason: "need_two_players" as const, room: publicRoom(room) };
  }

  room.status = "playing";
  upsertRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export function leaveTriadRoom(code: string, participantId: string) {
  const room = rooms().find((item) => item.code === cleanText(code));
  if (!room) return { ok: true as const };
  const cleanRoom = removeParticipant(room, participantId);
  if (!cleanRoom.seats.host && !cleanRoom.seats.challenger && cleanRoom.spectators.length === 0) {
    deleteRoom(room.code);
    return { ok: true as const };
  }
  upsertRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}
