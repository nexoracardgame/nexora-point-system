import { NextResponse } from "next/server";
import { getApiActor, requireAdminActor, type ApiActor } from "@/lib/admin-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import {
  createTriadRoom,
  advanceTriadRoomTurn,
  clearTriadRooms,
  chooseTriadRoomOpeningTieBreak,
  chooseTriadRoomSkillTarget,
  disbandTriadRoom,
  joinTriadRoom,
  listTriadRankProfiles,
  leaveTriadRoom,
  listTriadRooms,
  lockTriadRoomCard,
  moveTriadParticipantToSpectator,
  resetTriadRoomBattle,
  resetTriadRoomOpeningTieBreak,
  readyTriadRoomDeck,
  setTriadRoomDeck,
  setTriadRoomBotOpponent,
  sendTriadRoomChatMessage,
  startTriadRoom,
  surrenderTriadRoom,
  runTriadRoomBot,
  takeTriadRoomSlot,
  timeoutTriadRoomTurn,
  type TriadRoomAccess,
  type TriadRoomParticipant,
  type TriadRoomSlot,
} from "@/lib/triad-room-store";
import {
  TRIAD_ROOM_REALTIME_CHANNEL,
  TRIAD_ROOM_REALTIME_EVENT,
  type TriadRoomRealtimePayload,
} from "@/lib/triad-room-realtime";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getPayloadRoomCode(value: unknown) {
  const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const room = payload.room && typeof payload.room === "object" ? (payload.room as Record<string, unknown>) : {};
  return cleanText(room.code);
}

async function publishTriadRoomRealtime(payload: TriadRoomRealtimePayload) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return;

  const channel = supabase.channel(TRIAD_ROOM_REALTIME_CHANNEL, {
    config: {
      broadcast: {
        ack: false,
        self: false,
      },
    },
  });

  try {
    await channel.send(
      {
        type: "broadcast",
        event: TRIAD_ROOM_REALTIME_EVENT,
        payload: {
          ...payload,
          at: Date.now(),
        } satisfies TriadRoomRealtimePayload,
      },
      { timeout: 500 }
    );
  } catch {
    // Realtime is an acceleration path; HTTP polling remains the fallback.
  } finally {
    void supabase.removeChannel(channel);
  }
}

async function roomActionJson(
  body: unknown,
  init?: ResponseInit,
  realtime?: TriadRoomRealtimePayload | null
) {
  if (realtime) {
    await publishTriadRoomRealtime(realtime);
  }
  return noStoreJson(body, init);
}

function participantFromActor(body: Record<string, unknown>, actor: ApiActor): TriadRoomParticipant {
  const raw = body.participant && typeof body.participant === "object" ? (body.participant as Record<string, unknown>) : {};
  return {
    id: actor.id,
    name: actor.name || actor.lineId || cleanText(raw.name) || "PLAYER",
    image: actor.image || cleanText(raw.image) || "/avatar.png",
    joinedAt: Number(raw.joinedAt || Date.now()),
  };
}

export async function GET() {
  const actor = await getApiActor();
  if (!actor) return noStoreJson({ error: "unauthorized" }, { status: 401 });

  const [rooms, rankProfiles] = await Promise.all([listTriadRooms(), listTriadRankProfiles()]);
  return noStoreJson({
    rooms,
    rankProfiles,
    leaderboard: rankProfiles.filter((profile) => profile.wins > 0),
  });
}

export async function POST(request: Request) {
  const actor = await getApiActor();
  if (!actor) return noStoreJson({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = cleanText(body.action);

  if (action === "clear-all") {
    const { error } = await requireAdminActor();
    if (error) return error;
    const result = await clearTriadRooms();
    return roomActionJson(result, undefined, { action, refresh: true });
  }

  const participant = participantFromActor(body, actor);

  if (!participant.id) {
    return noStoreJson({ error: "participant_required" }, { status: 400 });
  }

  if (action === "create") {
    const access: TriadRoomAccess = body.access === "private" ? "private" : "public";
    const password = cleanText(body.password);
    if (access === "private" && password.length < 4) {
      return noStoreJson({ error: "password_too_short" }, { status: 400 });
    }
    const deckMode = body.deckMode === "monster" || body.deckMode === "skill" ? body.deckMode : "all";
    const room = await createTriadRoom({ access, password, participant, deckMode, playWithBot: Boolean(body.playWithBot) });
    return roomActionJson({ room }, undefined, { action, code: room.code, room });
  }

  if (action === "join") {
    const result = await joinTriadRoom({
      code: cleanText(body.code),
      password: cleanText(body.password),
      participant,
      forceSpectator: Boolean(body.forceSpectator),
    });
    const status = result.ok ? 200 : result.reason === "wrong_password" ? 403 : result.reason === "not_found" ? 404 : 409;
    return roomActionJson(
      result,
      { status },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "spectate") {
    const result = await moveTriadParticipantToSpectator(cleanText(body.code), participant);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "take-slot") {
    const slot: TriadRoomSlot = body.slot === "host" ? "host" : "challenger";
    const result = await takeTriadRoomSlot(cleanText(body.code), slot, participant);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "start") {
    const result = await startTriadRoom(cleanText(body.code), participant.id);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "set-bot") {
    const result = await setTriadRoomBotOpponent(cleanText(body.code), participant.id, Boolean(body.enabled));
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "run-bot") {
    const result = await runTriadRoomBot(cleanText(body.code), participant.id);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "set-deck") {
    const deck = Array.isArray(body.deck) ? body.deck.map((item) => cleanText(item)).filter(Boolean) : [];
    const result = await setTriadRoomDeck(cleanText(body.code), participant.id, deck);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "ready-deck") {
    const deck = Array.isArray(body.deck) ? body.deck.map((item) => cleanText(item)).filter(Boolean) : [];
    const result = await readyTriadRoomDeck(cleanText(body.code), participant.id, deck);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "lock-card") {
    const result = await lockTriadRoomCard(cleanText(body.code), participant.id, cleanText(body.cardNo));
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "choose-skill-target") {
    const result = await chooseTriadRoomSkillTarget(cleanText(body.code), participant.id, cleanText(body.selectedTarget));
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      "room" in result ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "choose-opening-tiebreak") {
    const result = await chooseTriadRoomOpeningTieBreak(
      cleanText(body.code),
      participant,
      body.choice === "rock" || body.choice === "scissors" || body.choice === "paper" ? body.choice : "unknown"
    );
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      "room" in result ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "reset-opening-tiebreak") {
    const result = await resetTriadRoomOpeningTieBreak(cleanText(body.code), participant);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      "room" in result ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "advance-turn") {
    const requestedTurn = Number(body.turn || body.activeTurn);
    const result = await advanceTriadRoomTurn(cleanText(body.code), participant.id, {
      fightNo: Number(body.fightNo) || undefined,
      turn: requestedTurn === 1 || requestedTurn === 2 || requestedTurn === 3 ? requestedTurn : undefined,
    });
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "timeout-turn") {
    const result = await timeoutTriadRoomTurn(cleanText(body.code), participant.id);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "surrender") {
    const result = await surrenderTriadRoom(cleanText(body.code), participant.id);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "chat") {
    const result = await sendTriadRoomChatMessage(cleanText(body.code), participant, cleanText(body.text));
    return roomActionJson(
      result,
      { status: result.ok ? 200 : result.reason === "not_found" ? 404 : 409 },
      "room" in result ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "continue") {
    const result = await resetTriadRoomBattle(cleanText(body.code), participant.id);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code: getPayloadRoomCode(result), room: result.room } : null
    );
  }

  if (action === "disband") {
    const code = cleanText(body.code);
    const result = await disbandTriadRoom(code, participant.id);
    return roomActionJson(
      result,
      { status: result.ok ? 200 : 409 },
      result.ok ? { action, code, deleted: true } : null
    );
  }

  if (action === "leave") {
    const code = cleanText(body.code);
    const result = await leaveTriadRoom(code, participant.id);
    const room = "room" in result ? result.room : null;
    return roomActionJson(
      result,
      undefined,
      room
        ? { action, code: getPayloadRoomCode(result), room }
        : { action, code, deleted: true }
    );
  }

  return noStoreJson({ error: "unknown_action" }, { status: 400 });
}
