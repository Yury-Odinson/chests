import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/shared/types/events";
import type { GameLogItem, GameRoom } from "@/shared/types/game";
import { getStateForPlayer } from "@/server/game/getStateForPlayer";

export type GameIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function broadcastState(io: GameIO, room: GameRoom): void {
  for (const player of room.players) {
    if (!player.socketId) continue;
    const state = getStateForPlayer(room, player.id);
    if (!state) continue;
    io.to(player.socketId).emit("game:state", state);
  }
}

export function broadcastLogs(
  io: GameIO,
  room: GameRoom,
  logs: GameLogItem[]
): void {
  if (logs.length === 0) return;
  for (const player of room.players) {
    if (!player.socketId) continue;
    for (const log of logs) {
      io.to(player.socketId).emit("game:log", log);
    }
  }
}
