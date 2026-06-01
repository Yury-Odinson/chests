import type { GameRoom } from "@/shared/types/game";
import { err, findPlayer, makeLog, ok } from "./helpers";
import type { EngineResult } from "./types";

/**
 * Host removes another player (human or bot) from the lobby. Only allowed
 * before the game starts. Returns the kicked player's id so the socket layer
 * can disconnect their session.
 */
export function kickPlayer(
  room: GameRoom,
  args: { hostId: string; targetId: string }
): EngineResult & { kickedId?: string } {
  if (room.status !== "waiting") {
    return err("Выгнать игрока можно только до старта игры");
  }
  if (args.hostId !== room.hostId) {
    return err("Только хост может выгнать игрока");
  }
  if (args.targetId === args.hostId) {
    return err("Нельзя выгнать самого себя");
  }

  const target = findPlayer(room, args.targetId);
  if (!target) {
    return err("Игрок не найден");
  }

  const next: GameRoom = {
    ...room,
    players: room.players.filter((p) => p.id !== args.targetId),
  };
  const logs = [makeLog(`**${target.name}** удалён из комнаты`, "muted")];
  return { ...ok(next, logs), kickedId: args.targetId };
}
