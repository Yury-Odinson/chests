import { customAlphabet, nanoid } from "nanoid";
import type { GameRoom, Player } from "@/shared/types/game";

const roomIdGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function createRoom(args: {
  hostSocketId: string;
  hostName: string;
}): GameRoom {
  const playerId = nanoid(10);
  const host: Player = {
    id: playerId,
    socketId: args.hostSocketId,
    name: args.hostName,
    hand: [],
    chests: [],
    connected: true,
  };
  return {
    id: roomIdGen(),
    status: "waiting",
    hostId: playerId,
    players: [host],
    deck: [],
    currentPlayerId: null,
    pendingGuess: null,
    winnerIds: [],
    log: [],
    createdAt: new Date().toISOString(),
  };
}
