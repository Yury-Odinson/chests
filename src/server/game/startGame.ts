import type { GameRoom } from "@/shared/types/game";
import { createDeck } from "./createDeck";
import { err, makeLog, ok } from "./helpers";
import { shuffleDeck } from "./shuffleDeck";
import type { EngineResult, Rng } from "./types";

export function handSizeFor(playerCount: number): number {
  return playerCount <= 3 ? 7 : 5;
}

export function startGame(
  room: GameRoom,
  args: { hostId: string; rng?: Rng } = { hostId: "" }
): EngineResult {
  if (room.status !== "waiting") {
    return err("Игра уже идёт или завершена");
  }
  if (room.players.length < 2) {
    return err("Нужно минимум 2 игрока");
  }
  if (room.players.length > 5) {
    return err("Максимум 5 игроков");
  }
  if (args.hostId && args.hostId !== room.hostId) {
    return err("Только хост может начать игру");
  }

  const handSize = handSizeFor(room.players.length);
  const deck = shuffleDeck(createDeck(), args.rng);

  const players = room.players.map((p) => ({
    ...p,
    hand: deck.splice(0, handSize),
  }));

  const firstPlayer = players[0];

  const next: GameRoom = {
    ...room,
    status: "playing",
    players,
    deck,
    currentPlayerId: firstPlayer.id,
    pendingGuess: null,
    winnerIds: [],
  };

  const logs = [
    makeLog(
      `Игра началась. Раздача по **${handSize}** карт. Первым ходит **${firstPlayer.name}**.`,
      "info"
    ),
  ];

  return ok(next, logs);
}
