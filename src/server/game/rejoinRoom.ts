import type { GameRoom } from "@/shared/types/game";
import { err, findPlayer, makeLog, ok, updatePlayer } from "./helpers";
import type { EngineResult } from "./types";

export function rejoinRoom(
  room: GameRoom,
  args: { playerId: string; socketId: string }
): EngineResult {
  const player = findPlayer(room, args.playerId);
  if (!player) {
    return err("Игрок не найден");
  }
  const next = updatePlayer(room, args.playerId, (p) => ({
    ...p,
    socketId: args.socketId,
    connected: true,
  }));
  const logs = player.connected
    ? []
    : [makeLog(`**${player.name}** вернулся в игру`, "info")];
  return ok(next, logs);
}
