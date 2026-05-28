import { nanoid } from "nanoid";
import type {
  Card,
  GameLogItem,
  GameLogKind,
  GameRoom,
  Player,
  Rank,
} from "@/shared/types/game";
import type { EngineResult } from "./types";

export function makeLog(
  message: string,
  kind: GameLogKind = "neutral"
): GameLogItem {
  return {
    id: nanoid(8),
    createdAt: new Date().toISOString(),
    message,
    kind,
  };
}

export function ok(room: GameRoom, logs: GameLogItem[] = []): EngineResult {
  return { ok: true, room: appendLogs(room, logs), logs };
}

export function err(error: string): EngineResult {
  return { ok: false, error };
}

const LOG_LIMIT = 100;

export function appendLogs(room: GameRoom, logs: GameLogItem[]): GameRoom {
  if (logs.length === 0) return room;
  const next = [...room.log, ...logs];
  const trimmed = next.length > LOG_LIMIT ? next.slice(-LOG_LIMIT) : next;
  return { ...room, log: trimmed };
}

export function findPlayer(
  room: GameRoom,
  playerId: string
): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

export function countRankInHand(player: Player, rank: Rank): number {
  return player.hand.filter((c) => c.rank === rank).length;
}

export function cardsOfRank(player: Player, rank: Rank): Card[] {
  return player.hand.filter((c) => c.rank === rank);
}

export function updatePlayer(
  room: GameRoom,
  playerId: string,
  update: (player: Player) => Player
): GameRoom {
  return {
    ...room,
    players: room.players.map((p) => (p.id === playerId ? update(p) : p)),
  };
}

export function totalChestsCollected(room: GameRoom): number {
  return room.players.reduce((sum, p) => sum + p.chests.length, 0);
}

export function playerNameById(
  room: GameRoom,
  playerId: string | null
): string {
  if (!playerId) return "никто";
  return findPlayer(room, playerId)?.name ?? "игрок";
}
