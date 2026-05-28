import type { GameLogItem, GameRoom } from "@/shared/types/game";
import { makeLog, totalChestsCollected } from "./helpers";

export function finishGame(room: GameRoom): {
  room: GameRoom;
  logs: GameLogItem[];
} {
  if (room.status === "finished") return { room, logs: [] };

  const maxChests = room.players.reduce(
    (max, p) => (p.chests.length > max ? p.chests.length : max),
    0
  );
  const winners = room.players.filter((p) => p.chests.length === maxChests);
  const winnerIds = winners.map((p) => p.id);
  const winnerNames = winners.map((p) => p.name).join(", ");

  const log = makeLog(
    `Игра окончена. Победил: **${winnerNames}** (**${maxChests}** сундуков).`,
    "info"
  );

  return {
    room: {
      ...room,
      status: "finished",
      currentPlayerId: null,
      pendingGuess: null,
      winnerIds,
    },
    logs: [log],
  };
}

export function isGameOver(room: GameRoom): boolean {
  return totalChestsCollected(room) >= 13;
}
