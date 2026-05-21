import { NextResponse } from "next/server";
import { requireAdminActor } from "@/lib/admin-auth";
import {
  createTriadRoom,
  joinTriadRoom,
  leaveTriadRoom,
  listTriadRooms,
  moveTriadParticipantToSpectator,
  startTriadRoom,
  takeTriadRoomSlot,
  type TriadRoomAccess,
  type TriadRoomParticipant,
  type TriadRoomSlot,
} from "@/lib/triad-room-store";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function participantFromBody(body: Record<string, unknown>, fallbackName: string): TriadRoomParticipant {
  const raw = body.participant && typeof body.participant === "object" ? (body.participant as Record<string, unknown>) : {};
  return {
    id: cleanText(raw.id),
    name: cleanText(raw.name) || fallbackName || "ADMIN",
    image: cleanText(raw.image) || "/avatar.png",
    joinedAt: Number(raw.joinedAt || Date.now()),
  };
}

export async function GET() {
  const { error } = await requireAdminActor();
  if (error) return error;

  return noStoreJson({ rooms: listTriadRooms() });
}

export async function POST(request: Request) {
  const { actor, error } = await requireAdminActor();
  if (error || !actor) return error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = cleanText(body.action);
  const participant = participantFromBody(body, actor.name || actor.lineId);

  if (!participant.id) {
    return noStoreJson({ error: "participant_required", rooms: listTriadRooms() }, { status: 400 });
  }

  if (action === "create") {
    const access: TriadRoomAccess = body.access === "private" ? "private" : "public";
    const password = cleanText(body.password);
    if (access === "private" && password.length < 4) {
      return noStoreJson({ error: "password_too_short", rooms: listTriadRooms() }, { status: 400 });
    }
    const room = createTriadRoom({ access, password, participant });
    return noStoreJson({ room, rooms: listTriadRooms() });
  }

  if (action === "join") {
    const result = joinTriadRoom({
      code: cleanText(body.code),
      password: cleanText(body.password),
      participant,
      forceSpectator: Boolean(body.forceSpectator),
    });
    const status = result.ok ? 200 : result.reason === "wrong_password" ? 403 : result.reason === "not_found" ? 404 : 409;
    return noStoreJson({ ...result, rooms: listTriadRooms() }, { status });
  }

  if (action === "spectate") {
    const result = moveTriadParticipantToSpectator(cleanText(body.code), participant);
    return noStoreJson({ ...result, rooms: listTriadRooms() }, { status: result.ok ? 200 : 409 });
  }

  if (action === "take-slot") {
    const slot: TriadRoomSlot = body.slot === "host" ? "host" : "challenger";
    const result = takeTriadRoomSlot(cleanText(body.code), slot, participant);
    return noStoreJson({ ...result, rooms: listTriadRooms() }, { status: result.ok ? 200 : 409 });
  }

  if (action === "start") {
    const result = startTriadRoom(cleanText(body.code), participant.id);
    return noStoreJson({ ...result, rooms: listTriadRooms() }, { status: result.ok ? 200 : 409 });
  }

  if (action === "leave") {
    const result = leaveTriadRoom(cleanText(body.code), participant.id);
    return noStoreJson({ ...result, rooms: listTriadRooms() });
  }

  return noStoreJson({ error: "unknown_action", rooms: listTriadRooms() }, { status: 400 });
}
