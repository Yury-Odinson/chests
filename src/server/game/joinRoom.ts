import { nanoid } from "nanoid";
import type { GameRoom, Player } from "@/shared/types/game";
import { err, makeLog, ok } from "./helpers";
import type { EngineResult } from "./types";

export const MAX_PLAYERS = 5;

export function joinRoom(
  room: GameRoom,
  args: { socketId: string; playerName: string }
): EngineResult & { playerId?: string } {
  const name = args.playerName.trim();

  if (room.status !== "waiting") {
    return err("Игра уже началась");
  }
  if (room.players.length >= MAX_PLAYERS) {
    return err("Комната уже заполнена");
  }
  if (!name) {
    return err("Имя не может быть пустым");
  }
  if (room.players.some((p) => p.name === name)) {
    return err("Игрок с таким именем уже в комнате");
  }

  const playerId = nanoid(10);
  const newPlayer: Player = {
    id: playerId,
    socketId: args.socketId,
    name,
    hand: [],
    chests: [],
    connected: true,
  };

  const next: GameRoom = {
    ...room,
    players: [...room.players, newPlayer],
  };

  const logs = [makeLog(`**${name}** зашёл в комнату`, "muted")];
  return { ...ok(next, logs), playerId };
}
