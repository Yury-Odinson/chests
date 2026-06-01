import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  GameAskRankPayload,
  GameGuessCountPayload,
  GameGuessSuitsPayload,
  RoomAddBotPayload,
  RoomCreatePayload,
  RoomFinishPayload,
  RoomJoinPayload,
  RoomKickPayload,
  RoomLeavePayload,
  RoomRejoinPayload,
  RoomStartPayload,
  ServerToClientEvents,
  SocketData,
} from "@/shared/types/events";
import type { EngineResult } from "@/server/game/types";
import { addBot } from "@/server/game/addBot";
import { askRank } from "@/server/game/askRank";
import { createRoom } from "@/server/game/createRoom";
import { passTurn } from "@/server/game/finalize";
import { finishGame } from "@/server/game/finishGame";
import { guessAllSuits } from "@/server/game/guessAllSuits";
import { guessCount } from "@/server/game/guessCount";
import { joinRoom } from "@/server/game/joinRoom";
import { kickPlayer } from "@/server/game/kickPlayer";
import { leaveRoom } from "@/server/game/leaveRoom";
import { rejoinRoom } from "@/server/game/rejoinRoom";
import { startGame } from "@/server/game/startGame";
import { roomsStore } from "@/server/rooms/roomsStore";
import {
  broadcastLobby,
  broadcastLogs,
  broadcastState,
  emitPresence,
  emitRoomList,
  LOBBY_ROOM,
  onlineCount,
  schedulePresence,
  type GameIO,
} from "./broadcast";
import { maybeScheduleBotTurn } from "./botRunner";

type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

function emitError(socket: GameSocket, message: string): void {
  socket.emit("game:error", { message });
}

function applyResult(
  io: GameIO,
  socket: GameSocket,
  result: EngineResult
): void {
  if (!result.ok) {
    emitError(socket, result.error);
    return;
  }
  roomsStore.set(result.room);
  broadcastLogs(io, result.room, result.logs);
  broadcastState(io, result.room);
  maybeScheduleBotTurn(io, result.room.id);
}

export function registerHandlers(io: GameIO, socket: GameSocket): void {
  socket.on("lobby:join", () => {
    socket.join(LOBBY_ROOM);
    emitRoomList(socket);
    emitPresence(socket, onlineCount(io));
  });

  socket.on("lobby:leave", () => {
    socket.leave(LOBBY_ROOM);
  });

  socket.on("room:create", (payload: RoomCreatePayload) => {
    const name = payload.playerName?.trim();
    if (!name) return emitError(socket, "Имя не может быть пустым");

    const room = createRoom({ hostSocketId: socket.id, hostName: name });
    roomsStore.set(room);

    const playerId = room.players[0].id;
    socket.data.playerId = playerId;
    socket.data.roomId = room.id;
    socket.leave(LOBBY_ROOM);
    socket.join(room.id);

    socket.emit("room:created", { roomId: room.id, playerId });
    broadcastState(io, room);
    broadcastLobby(io);
  });

  socket.on("room:join", (payload: RoomJoinPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");

    const result = joinRoom(room, {
      socketId: socket.id,
      playerName: payload.playerName,
    });
    if (!result.ok) return emitError(socket, result.error);

    const playerId = result.playerId!;
    socket.data.playerId = playerId;
    socket.data.roomId = result.room.id;
    socket.leave(LOBBY_ROOM);
    socket.join(result.room.id);

    roomsStore.set(result.room);
    socket.emit("room:joined", { roomId: result.room.id, playerId });
    broadcastLogs(io, result.room, result.logs);
    broadcastState(io, result.room);
    broadcastLobby(io);
  });

  socket.on("room:rejoin", (payload: RoomRejoinPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return socket.emit("session:invalid");
    if (!room.players.some((p) => p.id === payload.playerId)) {
      return socket.emit("session:invalid");
    }

    const result = rejoinRoom(room, {
      playerId: payload.playerId,
      socketId: socket.id,
    });
    if (!result.ok) return emitError(socket, result.error);

    socket.data.playerId = payload.playerId;
    socket.data.roomId = room.id;
    socket.leave(LOBBY_ROOM);
    socket.join(room.id);

    roomsStore.set(result.room);
    socket.emit("room:joined", { roomId: room.id, playerId: payload.playerId });
    broadcastLogs(io, result.room, result.logs);
    broadcastState(io, result.room);
    broadcastLobby(io);
  });

  socket.on("room:leave", (payload: RoomLeavePayload) => {
    handleLeave(io, socket, payload.roomId, false);
  });

  socket.on("room:start", (payload: RoomStartPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");
    const playerId = socket.data.playerId;
    if (!playerId) return emitError(socket, "Вы не в комнате");

    applyResult(io, socket, startGame(room, { hostId: playerId }));
    broadcastLobby(io);
  });

  socket.on("room:finish", (payload: RoomFinishPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");
    if (socket.data.playerId !== room.hostId) {
      return emitError(socket, "Только хост может завершить партию");
    }
    if (room.status !== "playing") {
      return emitError(socket, "Игра не идёт");
    }
    const { room: next, logs } = finishGame(room);
    roomsStore.set(next);
    broadcastLogs(io, next, logs);
    broadcastState(io, next);
  });

  socket.on("room:add-bot", (payload: RoomAddBotPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");
    const playerId = socket.data.playerId;
    if (!playerId) return emitError(socket, "Вы не в комнате");

    const result = addBot(room, { hostId: playerId });
    if (!result.ok) return emitError(socket, result.error);

    roomsStore.set(result.room);
    broadcastLogs(io, result.room, result.logs);
    broadcastState(io, result.room);
    broadcastLobby(io);
  });

  socket.on("room:kick", (payload: RoomKickPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");
    const hostId = socket.data.playerId;
    if (!hostId) return emitError(socket, "Вы не в комнате");

    // Capture the target's socket before removal so we can boot their session.
    const targetSocketId = room.players.find(
      (p) => p.id === payload.targetPlayerId
    )?.socketId;

    const result = kickPlayer(room, {
      hostId,
      targetId: payload.targetPlayerId,
    });
    if (!result.ok) return emitError(socket, result.error);

    roomsStore.set(result.room);

    // Tell the kicked human (if any) to drop their session and leave the room.
    if (targetSocketId) {
      io.to(targetSocketId).emit("room:kicked");
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(room.id);
        targetSocket.data.playerId = undefined;
        targetSocket.data.roomId = undefined;
      }
    }

    broadcastLogs(io, result.room, result.logs);
    broadcastState(io, result.room);
    broadcastLobby(io);
  });

  socket.on("game:ask-rank", (payload: GameAskRankPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");
    const askerId = socket.data.playerId;
    if (!askerId) return emitError(socket, "Вы не в комнате");

    applyResult(
      io,
      socket,
      askRank(room, {
        askerId,
        targetId: payload.targetPlayerId,
        rank: payload.rank,
      })
    );
  });

  socket.on("game:guess-count", (payload: GameGuessCountPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");
    const askerId = socket.data.playerId;
    if (!askerId) return emitError(socket, "Вы не в комнате");

    applyResult(
      io,
      socket,
      guessCount(room, { askerId, count: payload.count })
    );
  });

  socket.on("game:guess-suits", (payload: GameGuessSuitsPayload) => {
    const room = roomsStore.get(payload.roomId);
    if (!room) return emitError(socket, "Комната не найдена");
    const askerId = socket.data.playerId;
    if (!askerId) return emitError(socket, "Вы не в комнате");

    applyResult(
      io,
      socket,
      guessAllSuits(room, { askerId, suits: payload.suits })
    );
  });

  socket.on("disconnect", () => {
    // Presence drops on any disconnect, lobby or in-game. The throttled
    // broadcast fires after this socket is already off clientsCount, so it
    // reads the correct, decremented count — no manual adjustment needed.
    schedulePresence(io);
    const room = roomsStore.findBySocketId(socket.id);
    if (!room) return;
    handleLeave(io, socket, room.id, true);
  });
}

function handleLeave(
  io: GameIO,
  socket: GameSocket,
  roomId: string,
  isDisconnect: boolean
): void {
  const room = roomsStore.get(roomId);
  if (!room) return;
  const playerId = socket.data.playerId;
  if (!playerId) return;

  const wasCurrent = room.currentPlayerId === playerId;
  const result = leaveRoom(room, { playerId });
  if (!result.ok) {
    if (!isDisconnect) emitError(socket, result.error);
    return;
  }

  if (!isDisconnect && room.status === "finished" && playerId === room.hostId) {
    closeRoom(io, room.id);
    return;
  }

  if (result.destroyed) {
    roomsStore.delete(room.id);
    broadcastLobby(io);
    return;
  }

  let finalRoom = result.room;
  let logs = [...result.logs];

  if (room.status === "playing" && wasCurrent && isDisconnect) {
    const turn = passTurn(finalRoom, playerId);
    finalRoom = turn.room;
    logs = [...logs, ...turn.logs];
  }

  // A started/finished game no human is connected to anymore is dead weight —
  // drop it instead of leaving bots playing to an empty room. (Bots are always
  // `connected`, so we check specifically for a connected human.)
  if (
    finalRoom.status !== "waiting" &&
    !finalRoom.players.some((p) => !p.isBot && p.connected)
  ) {
    roomsStore.delete(finalRoom.id);
    if (!isDisconnect) {
      socket.leave(finalRoom.id);
      socket.data.playerId = undefined;
      socket.data.roomId = undefined;
    }
    return;
  }

  roomsStore.set(finalRoom);
  broadcastLogs(io, finalRoom, logs);
  broadcastState(io, finalRoom);
  broadcastLobby(io);
  maybeScheduleBotTurn(io, finalRoom.id);

  if (!isDisconnect) {
    socket.leave(room.id);
    socket.data.playerId = undefined;
    socket.data.roomId = undefined;
  }
}

function closeRoom(io: GameIO, roomId: string): void {
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (sockets) {
    for (const socketId of [...sockets]) {
      const participant = io.sockets.sockets.get(socketId);
      participant?.emit("room:closed");
      participant?.leave(roomId);
      if (participant) {
        participant.data.playerId = undefined;
        participant.data.roomId = undefined;
      }
    }
  }
  roomsStore.delete(roomId);
  broadcastLobby(io);
}
