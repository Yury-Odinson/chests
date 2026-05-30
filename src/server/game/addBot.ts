import { nanoid } from "nanoid";
import type { GameRoom, Player } from "@/shared/types/game";
import { err, makeLog, ok } from "./helpers";
import { MAX_PLAYERS } from "./joinRoom";
import type { EngineResult } from "./types";

const BOT_NAMES = [
  "Бот Клаус",
  "Бот Морган",
  "Бот Сильвер",
  "Бот Дрейк",
  "Бот Флинт",
];

function nextBotName(room: GameRoom): string {
  const taken = new Set(room.players.map((p) => p.name));
  const free = BOT_NAMES.find((n) => !taken.has(n));
  if (free) return free;
  // All themed names used — fall back to a numbered bot.
  let i = 1;
  while (taken.has(`Бот ${i}`)) i++;
  return `Бот ${i}`;
}

export function addBot(
  room: GameRoom,
  args: { hostId: string }
): EngineResult {
  if (room.status !== "waiting") {
    return err("Бота можно добавить только до старта игры");
  }
  if (args.hostId !== room.hostId) {
    return err("Только хост может добавить бота");
  }
  if (room.players.length >= MAX_PLAYERS) {
    return err("Комната уже заполнена");
  }

  const bot: Player = {
    id: nanoid(10),
    socketId: null,
    name: nextBotName(room),
    hand: [],
    chests: [],
    connected: true,
    isBot: true,
  };

  const next: GameRoom = {
    ...room,
    players: [...room.players, bot],
  };
  const logs = [makeLog(`**${bot.name}** присоединился к игре`, "muted")];
  return ok(next, logs);
}
