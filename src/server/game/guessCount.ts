import type { GameRoom } from "@/shared/types/game";
import { observeCountCorrect, observeCountWrong } from "./botMemory";
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

export function guessCount(
  room: GameRoom,
  args: { askerId: string; count: number }
): EngineResult {
  if (!room.pendingGuess || room.pendingGuess.stage !== "awaiting-detail") {
    return err("Сейчас нельзя называть количество");
  }
  if (room.pendingGuess.askerId !== args.askerId) {
    return err("Уточнение делает другой игрок");
  }

  const { targetId, rank } = room.pendingGuess;
  const asker = findPlayer(room, args.askerId);
  const target = findPlayer(room, targetId);
  if (!asker || !target) return err("Игрок не найден");

  const askerCount = countRankInHand(asker, rank);
  const maxPossible = 4 - askerCount;
  if (args.count < 1 || args.count > maxPossible) {
    return err(`Количество должно быть от 1 до ${maxPossible}`);
  }

  const actual = countRankInHand(target, rank);

  if (args.count === actual) {
    const log = makeLog(
      `**${asker.name}** верно угадал количество: **${args.count}**. Теперь нужно назвать масти.`,
      "success"
    );
    const next: GameRoom = {
      ...room,
      botMemory: observeCountCorrect(room, targetId, rank, actual),
      pendingGuess: {
        stage: "awaiting-suits",
        askerId: args.askerId,
        targetId,
        rank,
        count: actual,
      },
    };
    return ok(next, [log]);
  }

  const log = makeLog(
    `**${asker.name}** назвал количество неверно: **${args.count}**.`,
    "error"
  );
  const observed: GameRoom = {
    ...room,
    botMemory: observeCountWrong(room, targetId, rank, args.count),
  };
  const draw = drawCard(observed, args.askerId);
  const turn = passTurn(draw.room, args.askerId);
  const final = maybeFinish(turn.room, [log, ...draw.logs, ...turn.logs]);
  return ok(final.room, final.logs);
}
