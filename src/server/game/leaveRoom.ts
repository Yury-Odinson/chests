import type { GameRoom } from "@/shared/types/game";
import { err, findPlayer, makeLog, ok, updatePlayer } from "./helpers";
import type { EngineResult } from "./types";

export function leaveRoom(
  room: GameRoom,
  args: { playerId: string }
): EngineResult & { destroyed?: boolean } {
  const player = findPlayer(room, args.playerId);
  if (!player) {
    return err("Игрок не найден");
  }

  if (room.status === "waiting") {
    const remaining = room.players.filter((p) => p.id !== args.playerId);
    if (remaining.length === 0) {
      return { ok: true, room, logs: [], destroyed: true };
    }
    const nextHostId =
      room.hostId === args.playerId ? remaining[0].id : room.hostId;
    const next: GameRoom = {
      ...room,
      players: remaining,
      hostId: nextHostId,
    };
    const logs = [makeLog(`**${player.name}** покинул комнату`, "muted")];
    return ok(next, logs);
  }

  const next = updatePlayer(room, args.playerId, (p) => ({
    ...p,
    connected: false,
    socketId: null,
  }));
  const logs = [makeLog(`**${player.name}** отключился`, "muted")];
  return ok(next, logs);
}
