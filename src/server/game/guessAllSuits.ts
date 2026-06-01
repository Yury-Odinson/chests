import type { GameRoom, Suit } from "@/shared/types/game";
import { forgetRankForTarget, observeSuitsAbsent } from "./botMemory";
import { collectChests } from "./collectChests";
import { drawCard } from "./drawCard";
import { keepTurn, maybeFinish, passTurn } from "./finalize";
import {
  err,
  findPlayer,
  makeLog,
  ok,
  updatePlayer,
} from "./helpers";
import type { EngineResult } from "./types";

export function guessAllSuits(
  room: GameRoom,
  args: { askerId: string; suits: Suit[] }
): EngineResult {
  if (!room.pendingGuess || room.pendingGuess.stage !== "awaiting-suits") {
    return err("Сейчас нельзя называть масти");
  }
  if (room.pendingGuess.askerId !== args.askerId) {
    return err("Уточнение делает другой игрок");
  }

  const { targetId, rank, count } = room.pendingGuess;

  if (args.suits.length !== count) {
    return err(`Нужно назвать ровно ${count} мастей`);
  }
  if (new Set(args.suits).size !== args.suits.length) {
    return err("Масти должны быть разными");
  }

  const asker = findPlayer(room, args.askerId);
  const target = findPlayer(room, targetId);
  if (!asker || !target) return err("Игрок не найден");

  const targetCards = target.hand.filter((c) => c.rank === rank);
  const targetSuits = new Set(targetCards.map((c) => c.suit));

  const wrongSuits = args.suits.filter((s) => !targetSuits.has(s));

  if (wrongSuits.length === 0) {
    let next = updatePlayer(room, targetId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.rank !== rank),
    }));
    next = updatePlayer(next, args.askerId, (p) => ({
      ...p,
      hand: [...p.hand, ...targetCards],
    }));
    // All of the rank left the target — wipe any deductions about it.
    next = { ...next, botMemory: forgetRankForTarget(next, targetId, rank) };
    const log = makeLog(
      `**${asker.name}** верно назвал все масти: **${args.suits.join(", ")}**. Забирает **${count}** карт.`,
      "success",
      { fromPlayerId: targetId, toPlayerId: args.askerId, cards: targetCards }
    );
    const chest = collectChests(next, args.askerId);
    const cont = keepTurn(chest.room, args.askerId);
    const final = maybeFinish(cont.room, [log, ...chest.logs, ...cont.logs]);
    return ok(final.room, final.logs);
  }

  const log = makeLog(
    `**${asker.name}** назвал **${args.suits.join(", ")}**. Неверно: **${wrongSuits.join(", ")}**.`,
    "error"
  );
  const observed: GameRoom = {
    ...room,
    botMemory: observeSuitsAbsent(room, targetId, rank, wrongSuits),
  };
  const draw = drawCard(observed, args.askerId);
  const turn = passTurn(draw.room, args.askerId);
  const final = maybeFinish(turn.room, [log, ...draw.logs, ...turn.logs]);
  return ok(final.room, final.logs);
}
