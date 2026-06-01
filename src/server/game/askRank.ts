import type { GameRoom, Rank } from "@/shared/types/game";
import { observeRankAsk } from "./botMemory";
import { drawCard } from "./drawCard";
import { maybeFinish, passTurn } from "./finalize";
import {
  countRankInHand,
  err,
  findPlayer,
  makeLog,
  ok,
} from "./helpers";
import type { EngineResult } from "./types";

export function askRank(
  room: GameRoom,
  args: { askerId: string; targetId: string; rank: Rank }
): EngineResult {
  if (room.status !== "playing") return err("Игра не идёт");
  if (room.currentPlayerId !== args.askerId) return err("Сейчас не ваш ход");
  if (room.pendingGuess) return err("Сначала завершите уточнение");
  if (args.askerId === args.targetId) return err("Нельзя спрашивать себя");

  const asker = findPlayer(room, args.askerId);
  const target = findPlayer(room, args.targetId);
  if (!asker) return err("Игрок не найден");
  if (!target) return err("Соперник не найден");
  if (target.hand.length === 0) return err("У соперника нет карт");
  if (countRankInHand(asker, args.rank) === 0) {
    return err("Можно спрашивать только ранг, который у вас на руке");
  }

  const targetCount = countRankInHand(target, args.rank);
  const botMemory = observeRankAsk(
    room,
    args.targetId,
    args.rank,
    targetCount > 0
  );

  if (targetCount === 0) {
    const askLog = makeLog(
      `**${asker.name}** спросил у **${target.name}**: «**${args.rank}**?» — нет.`,
      "muted"
    );
    const draw = drawCard({ ...room, botMemory }, args.askerId);
    const turn = passTurn(draw.room, args.askerId);
    const final = maybeFinish(turn.room, [
      askLog,
      ...draw.logs,
      ...turn.logs,
    ]);
    return ok(final.room, final.logs);
  }

  const askLog = makeLog(
    `**${asker.name}** спросил у **${target.name}**: «**${args.rank}**?» — есть.`,
    "info"
  );
  const next: GameRoom = {
    ...room,
    botMemory,
    pendingGuess: {
      stage: "awaiting-detail",
      askerId: args.askerId,
      targetId: args.targetId,
      rank: args.rank,
    },
  };
  return ok(next, [askLog]);
}
