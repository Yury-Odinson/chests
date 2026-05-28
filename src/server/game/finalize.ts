import type { GameLogItem, GameRoom } from "@/shared/types/game";
import { finishGame, isGameOver } from "./finishGame";
import { drawCard } from "./drawCard";
import { getNextPlayerId } from "./getNextPlayerId";
import { makeLog, playerNameById } from "./helpers";

export function passTurn(
  room: GameRoom,
  fromPlayerId: string
): { room: GameRoom; logs: GameLogItem[] } {
  const nextId = getNextPlayerId(room, fromPlayerId);
  const turnLog = nextId
    ? makeLog(`Ход переходит к **${playerNameById(room, nextId)}**`, "neutral")
    : makeLog("Никто не может ходить", "muted");

  let next: GameRoom = {
    ...room,
    currentPlayerId: nextId,
    pendingGuess: null,
  };

  const logs: GameLogItem[] = [turnLog];

  if (nextId) {
    const nextPlayer = next.players.find((p) => p.id === nextId);
    if (nextPlayer && nextPlayer.hand.length === 0 && next.deck.length > 0) {
      const draw = drawCard(next, nextId);
      next = draw.room;
      logs.push(...draw.logs);
    }
  }

  return { room: next, logs };
}

export function maybeFinish(
  room: GameRoom,
  logs: GameLogItem[]
): { room: GameRoom; logs: GameLogItem[] } {
  if (isGameOver(room)) {
    const fin = finishGame(room);
    return { room: fin.room, logs: [...logs, ...fin.logs] };
  }
  return { room, logs };
}
