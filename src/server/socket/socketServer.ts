import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/shared/types/events";
import { roomsStore } from "@/server/rooms/roomsStore";
import { broadcastLobby } from "./broadcast";
import { registerHandlers } from "./handlers";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const ROOM_MAX_IDLE_MS = 30 * 60 * 1000;

export function attachSocketServer(httpServer: HttpServer): void {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    registerHandlers(io, socket);
  });

  const sweep = setInterval(() => {
    const removed = roomsStore.sweep(ROOM_MAX_IDLE_MS);
    if (removed > 0) broadcastLobby(io);
  }, SWEEP_INTERVAL_MS);
  sweep.unref();
}
