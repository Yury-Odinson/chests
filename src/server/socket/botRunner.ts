import { askRank } from "@/server/game/askRank";
import { decideBotAction } from "@/server/game/botBrain";
import { guessAllSuits } from "@/server/game/guessAllSuits";
import { guessCount } from "@/server/game/guessCount";
import { passTurn } from "@/server/game/finalize";
import { findPlayer } from "@/server/game/helpers";
import { roomsStore } from "@/server/rooms/roomsStore";
import type { EngineResult } from "@/server/game/types";
import type { GameRoom } from "@/shared/types/game";
import { broadcastLogs, broadcastState, type GameIO } from "./broadcast";

const MIN_DELAY_MS = 1800;
const MAX_DELAY_MS = 3500;

/** Rooms with a bot tick already queued, so we never double-schedule one. */
const scheduled = new Set<string>();

function thinkingDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

/**
 * Whoever must act right now: the pending-guess asker if a guess is mid-flight,
 * otherwise the current player. Returns the player or null.
 */
function actorId(room: GameRoom): string | null {
  if (room.pendingGuess) return room.pendingGuess.askerId;
  return room.currentPlayerId;
}

function isBotsMove(room: GameRoom): boolean {
  if (room.status !== "playing") return false;
  const id = actorId(room);
  if (!id) return false;
  return findPlayer(room, id)?.isBot ?? false;
}

/**
 * If it's a bot's move in this room, schedule it to act after a human-like
 * pause. Call this after every state broadcast. Safe to call repeatedly — it
 * de-dupes per room. The loop continues itself as long as a bot keeps acting.
 */
export function maybeScheduleBotTurn(io: GameIO, roomId: string): void {
  if (scheduled.has(roomId)) return;
  const room = roomsStore.get(roomId);
  if (!room || !isBotsMove(room)) return;

  scheduled.add(roomId);
  setTimeout(() => {
    scheduled.delete(roomId);
    runBotStep(io, roomId);
  }, thinkingDelay());
}

function runBotStep(io: GameIO, roomId: string): void {
  const room = roomsStore.get(roomId);
  if (!room || !isBotsMove(room)) return;

  const botId = actorId(room)!;
  const action = decideBotAction(room, botId);

  // No legal move (e.g. empty-handed bot): pass the turn so play continues.
  if (!action) {
    const turn = passTurn(room, botId);
    roomsStore.set(turn.room);
    broadcastLogs(io, turn.room, turn.logs);
    broadcastState(io, turn.room);
    maybeScheduleBotTurn(io, roomId);
    return;
  }

  const result = dispatch(room, botId, action);
  if (!result.ok) {
    // Shouldn't happen — the brain only emits legal moves — but never wedge the
    // game on a bad guess: pass the turn and move on.
    const turn = passTurn(room, botId);
    roomsStore.set(turn.room);
    broadcastLogs(io, turn.room, turn.logs);
    broadcastState(io, turn.room);
    maybeScheduleBotTurn(io, roomId);
    return;
  }

  roomsStore.set(result.room);
  broadcastLogs(io, result.room, result.logs);
  broadcastState(io, result.room);

  // The bot may keep the turn (successful take) or it may now be another bot's
  // turn — either way, re-check and schedule the next step.
  maybeScheduleBotTurn(io, roomId);
}

function dispatch(
  room: GameRoom,
  botId: string,
  action: ReturnType<typeof decideBotAction>
): EngineResult {
  switch (action!.type) {
    case "ask-rank":
      return askRank(room, {
        askerId: botId,
        targetId: action!.targetId,
        rank: action!.rank,
      });
    case "guess-count":
      return guessCount(room, { askerId: botId, count: action!.count });
    case "guess-suits":
      return guessAllSuits(room, { askerId: botId, suits: action!.suits });
  }
}
