import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/shared/types/events";
import { registerHandlers } from "./handlers";

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
}
