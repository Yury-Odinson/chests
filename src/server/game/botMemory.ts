import type {
  BotMemory,
  GameRoom,
  Rank,
  RankKnowledge,
  Suit,
} from "@/shared/types/game";

/**
 * Bot memory is a pure, server-only derivation of public play. Every record
 * here is something a human at the table would also know — never a hidden
 * hand. We keep a separate slot per bot (keyed botId → targetId → rank) so a
 * bot's own past guesses live alongside what it observed others do.
 *
 * All functions are pure: they return a new BotMemory and never mutate.
 */

function emptyKnowledge(): RankKnowledge {
  return {
    knownPresent: false,
    knownAbsent: false,
    absentSuits: [],
    triedCounts: [],
    revealedCount: null,
  };
}

/** Read knowledge for a (bot, target, rank), or a blank record if none yet. */
export function getKnowledge(
  memory: BotMemory,
  botId: string,
  targetId: string,
  rank: Rank
): RankKnowledge {
  return memory[botId]?.[targetId]?.[rank] ?? emptyKnowledge();
}

/** List the bot ids that have a memory slot (i.e. the bots in the room). */
function botIds(room: GameRoom): string[] {
  return room.players.filter((p) => p.isBot).map((p) => p.id);
}

/**
 * Apply an update to a single (target, rank) record for every bot in the
 * room. Because the underlying facts are public, all bots learn the same
 * thing — we just store it per-bot for clean lookups.
 */
function updateAllBots(
  room: GameRoom,
  targetId: string,
  rank: Rank,
  update: (k: RankKnowledge) => RankKnowledge
): BotMemory {
  const next: BotMemory = { ...room.botMemory };
  for (const botId of botIds(room)) {
    const forBot = next[botId] ?? {};
    const forTarget = forBot[targetId] ?? {};
    const current = forTarget[rank] ?? emptyKnowledge();
    next[botId] = {
      ...forBot,
      [targetId]: {
        ...forTarget,
        [rank]: update(current),
      },
    };
  }
  return next;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Reset everything known about a (target, rank) for all bots. Used when the
 * cards of that rank changed hands, so stale deductions are dropped.
 */
export function forgetRankForTarget(
  room: GameRoom,
  targetId: string,
  rank: Rank
): BotMemory {
  return updateAllBots(room, targetId, rank, () => emptyKnowledge());
}

// --- Observation recorders, one per public outcome ---------------------------

/** A rank ask resolved: target either holds the rank or doesn't. */
export function observeRankAsk(
  room: GameRoom,
  targetId: string,
  rank: Rank,
  present: boolean
): BotMemory {
  return updateAllBots(room, targetId, rank, (k) =>
    present
      ? { ...k, knownPresent: true, knownAbsent: false }
      : {
          ...emptyKnowledge(),
          knownAbsent: true,
        }
  );
}

/**
 * A count guess was wrong. The real count is NOT public (we don't reveal it),
 * so the only honest, public takeaways are: this count is wrong, and the rank
 * is present (we only reach the count stage after a "yes" on ask-rank).
 */
export function observeCountWrong(
  room: GameRoom,
  targetId: string,
  rank: Rank,
  guessed: number
): BotMemory {
  return updateAllBots(room, targetId, rank, (k) => ({
    ...k,
    knownPresent: true,
    triedCounts: unique([...k.triedCounts, guessed]),
  }));
}

/** A count guess was correct: the exact count is now public. */
export function observeCountCorrect(
  room: GameRoom,
  targetId: string,
  rank: Rank,
  count: number
): BotMemory {
  return updateAllBots(room, targetId, rank, (k) => ({
    ...k,
    knownPresent: true,
    revealedCount: count,
  }));
}

/** During an all-suits guess, some named suits were revealed absent. */
export function observeSuitsAbsent(
  room: GameRoom,
  targetId: string,
  rank: Rank,
  wrongSuits: Suit[]
): BotMemory {
  return updateAllBots(room, targetId, rank, (k) => ({
    ...k,
    absentSuits: unique([...k.absentSuits, ...wrongSuits]),
  }));
}
