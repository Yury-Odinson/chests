import type { GameRoom, Suit } from "@/shared/types/game";
import { forgetRankForTarget, observeSuitAbsent } from "./botMemory";
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

export function guessSuit(
  room: GameRoom,
  args: { askerId: string; suit: Suit }
): EngineResult {
  if (!room.pendingGuess || room.pendingGuess.stage !== "awaiting-detail") {
    return err("Сейчас нельзя называть масть");
  }
  if (room.pendingGuess.askerId !== args.askerId) {
    return err("Уточнение делает другой игрок");
  }

  const { targetId, rank } = room.pendingGuess;
  const asker = findPlayer(room, args.askerId);
  const target = findPlayer(room, targetId);
  if (!asker || !target) return err("Игрок не найден");

  const card = target.hand.find(
    (c) => c.rank === rank && c.suit === args.suit
  );

  if (card) {
    let next = updatePlayer(room, targetId, (p) => ({
      ...p,
      hand: p.hand.filter((c) => c.id !== card.id),
    }));
    next = updatePlayer(next, args.askerId, (p) => ({
      ...p,
      hand: [...p.hand, card],
    }));
    // The rank's distribution at the target just changed — drop stale memory.
    next = { ...next, botMemory: forgetRankForTarget(next, targetId, rank) };
    const askLog = makeLog(
      `**${asker.name}** назвал **${rank} ${args.suit}** — есть. Забирает карту, ход продолжается.`,
      "success"
    );
    const chest = collectChests(next, args.askerId);
    const cont = keepTurn(chest.room, args.askerId);
    const final = maybeFinish(cont.room, [
      askLog,
      ...chest.logs,
      ...cont.logs,
    ]);
    return ok(final.room, final.logs);
  }

  const missLog = makeLog(
    `**${asker.name}** назвал **${rank} ${args.suit}** — у **${target.name}** этой масти нет.`,
    "error"
  );
  const observed: GameRoom = {
    ...room,
    botMemory: observeSuitAbsent(room, targetId, rank, args.suit),
  };
  const draw = drawCard(observed, args.askerId);
  const turn = passTurn(draw.room, args.askerId);
  const final = maybeFinish(turn.room, [missLog, ...draw.logs, ...turn.logs]);
  return ok(final.room, final.logs);
}
