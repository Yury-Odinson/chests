import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/shared/types/events";
import type {
  GameLogItem,
  GameRoom,
  RoomSummary,
} from "@/shared/types/game";
import { getStateForPlayer } from "@/server/game/getStateForPlayer";
import { MAX_PLAYERS } from "@/server/game/joinRoom";
import { roomsStore } from "@/server/rooms/roomsStore";

export type GameIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type GameSocketLike = {
  emit: (event: "room:list", payload: { rooms: RoomSummary[] }) => unknown;
};

export const LOBBY_ROOM = "lobby";

/** Rooms shown in the lobby list: only those still gathering players. */
function toSummary(room: GameRoom): RoomSummary {
  const host = room.players.find((p) => p.id === room.hostId);
  return {
    roomId: room.id,
    hostName: host?.name ?? "—",
    playerCount: room.players.length,
    maxPlayers: MAX_PLAYERS,
    status: room.status,
  };
}

function lobbyRooms(): RoomSummary[] {
  return roomsStore
    .all()
    .filter((room) => room.status === "waiting")
    .map(toSummary);
}

/** Push the current room list to a single socket (e.g. on lobby enter). */
export function emitRoomList(socket: GameSocketLike): void {
  socket.emit("room:list", { rooms: lobbyRooms() });
}

/** Push the current room list to everyone watching the lobby. */
export function broadcastLobby(io: GameIO): void {
  io.to(LOBBY_ROOM).emit("room:list", { rooms: lobbyRooms() });
}

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
