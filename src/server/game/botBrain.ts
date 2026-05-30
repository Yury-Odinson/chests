import type { GameRoom, Player, Rank, Suit } from "@/shared/types/game";
import { SUITS } from "@/shared/types/game";
import { getKnowledge } from "./botMemory";
import { cardsOfRank, countRankInHand, findPlayer } from "./helpers";
import type { Rng } from "./types";

/**
 * What the bot wants to do next. Mirrors the four player actions the socket
 * layer can dispatch. `null` means "no legal move" (the runner should bail).
 */
export type BotAction =
  | { type: "ask-rank"; targetId: string; rank: Rank }
  | { type: "guess-suit"; suit: Suit }
  | { type: "guess-count"; count: number }
  | { type: "guess-suits"; suits: Suit[] };

/** Roughly 1-in-9 chance the bot makes a human-like mistake. */
const MISTAKE_RATE = 1 / 9;

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function ranksInHand(player: Player): Rank[] {
  return [...new Set(player.hand.map((c) => c.rank))];
}

function blunders(rng: Rng): boolean {
  return rng() < MISTAKE_RATE;
}

/**
 * Decide the bot's next move for the current room state. Pure: given the same
 * room and rng sequence it always returns the same action. The socket layer
 * calls this, applies the matching engine function, and repeats while the
 * bot's turn continues.
 */
export function decideBotAction(
  room: GameRoom,
  botId: string,
  rng: Rng = Math.random
): BotAction | null {
  const bot = findPlayer(room, botId);
  if (!bot) return null;

  // Mid-turn: a guess is pending and it's the bot's to resolve.
  if (room.pendingGuess && room.pendingGuess.askerId === botId) {
    if (room.pendingGuess.stage === "awaiting-detail") {
      return decideDetail(room, botId, room.pendingGuess.targetId, room.pendingGuess.rank, rng);
    }
    if (room.pendingGuess.stage === "awaiting-suits") {
      return decideSuits(
        room,
        botId,
        room.pendingGuess.targetId,
        room.pendingGuess.rank,
        room.pendingGuess.count,
        rng
      );
    }
  }

  // Start of turn: pick a target and a rank to ask about.
  return decideAsk(room, bot, rng);
}

// --- Stage 1: choosing whom to ask and for which rank ------------------------

function askableTargets(room: GameRoom, botId: string): Player[] {
  return room.players.filter(
    (p) => p.id !== botId && p.connected && p.hand.length > 0
  );
}

function decideAsk(room: GameRoom, bot: Player, rng: Rng): BotAction | null {
  const myRanks = ranksInHand(bot);
  if (myRanks.length === 0) return null;

  const targets = askableTargets(room, bot.id);
  if (targets.length === 0) return null;

  // Best knowledge first: a target we KNOW still holds a rank we also hold and
  // haven't fully cracked yet. This is how the bot exploits other players'
  // revealed info and chases its own earlier near-misses.
  type Lead = { targetId: string; rank: Rank };
  const leads: Lead[] = [];
  for (const target of targets) {
    for (const rank of myRanks) {
      const k = getKnowledge(room.botMemory, bot.id, target.id, rank);
      if (k.knownPresent) leads.push({ targetId: target.id, rank });
    }
  }

  // ~1/9: ignore what we know and just pick at random (may hit a dead end).
  if (leads.length > 0 && !blunders(rng)) {
    const lead = pick(leads, rng);
    return { type: "ask-rank", targetId: lead.targetId, rank: lead.rank };
  }

  // Otherwise pick a random target and a random rank from hand, but try to
  // avoid ranks we already know that target lacks (unless we're blundering).
  const target = pick(targets, rng);
  const mistaken = blunders(rng);
  const sensible = myRanks.filter(
    (r) => !getKnowledge(room.botMemory, bot.id, target.id, r).knownAbsent
  );
  const pool = mistaken || sensible.length === 0 ? myRanks : sensible;
  return { type: "ask-rank", targetId: target.id, rank: pick(pool, rng) };
}

// --- Stage 2: suit vs. count -------------------------------------------------

/**
 * How many of `rank` the target can possibly hold, given the bot already holds
 * some. Used both to bound count guesses and to know when a count is certain.
 */
function maxTargetCount(bot: Player, rank: Rank): number {
  return 4 - countRankInHand(bot, rank);
}

function decideDetail(
  room: GameRoom,
  botId: string,
  targetId: string,
  rank: Rank,
  rng: Rng
): BotAction {
  const bot = findPlayer(room, botId)!;
  const k = getKnowledge(room.botMemory, botId, targetId, rank);
  const cap = maxTargetCount(bot, rank);

  // Suits the bot itself holds can't be taken from the target; suits already
  // revealed absent are dead. What's left are the suits worth guessing.
  const ownSuits = new Set(cardsOfRank(bot, rank).map((c) => c.suit));
  const liveSuits = SUITS.filter(
    (s) => !ownSuits.has(s) && !k.absentSuits.includes(s)
  );

  // "Smart" style: go for COUNT when we can name it with confidence — either
  // the count was revealed, or only one count is still possible.
  const known = k.revealedCount;
  const certain =
    known !== null && known >= 1 && !k.triedCounts.includes(known);

  if (certain || cap === 1) {
    const count = certain ? (known as number) : 1;
    if (blunders(rng)) {
      const wrong = wrongCount(count, cap, k.triedCounts, rng);
      if (wrong !== null) return { type: "guess-count", count: wrong };
    }
    return { type: "guess-count", count };
  }

  // No certainty → cautious single-suit guess (low risk of a miss).
  if (liveSuits.length > 0 && !blunders(rng)) {
    return { type: "guess-suit", suit: pick(liveSuits, rng) };
  }

  // Blundering, or no live suit deduced: guess a count we haven't tried yet.
  const untried = countOptions(cap).filter((c) => !k.triedCounts.includes(c));
  const pool = untried.length > 0 ? untried : countOptions(cap);
  return { type: "guess-count", count: pick(pool, rng) };
}

function countOptions(cap: number): number[] {
  const out: number[] = [];
  for (let c = 1; c <= cap; c++) out.push(c);
  return out;
}

function wrongCount(
  correct: number,
  cap: number,
  tried: number[],
  rng: Rng
): number | null {
  const options = countOptions(cap).filter(
    (c) => c !== correct && !tried.includes(c)
  );
  return options.length > 0 ? pick(options, rng) : null;
}

// --- Stage 3: naming all suits after a correct count -------------------------

function decideSuits(
  room: GameRoom,
  botId: string,
  targetId: string,
  rank: Rank,
  count: number,
  rng: Rng
): BotAction {
  const bot = findPlayer(room, botId)!;
  const k = getKnowledge(room.botMemory, botId, targetId, rank);
  const ownSuits = new Set(cardsOfRank(bot, rank).map((c) => c.suit));

  // Candidate suits the target might hold: not ours, not known-absent first.
  const preferred = SUITS.filter(
    (s) => !ownSuits.has(s) && !k.absentSuits.includes(s)
  );
  const fallback = SUITS.filter((s) => !ownSuits.has(s));
  const ordered = [...preferred, ...fallback.filter((s) => !preferred.includes(s))];

  let chosen = ordered.slice(0, count);

  // ~1/9: swap one good suit for a known-bad one to fluff a mistake.
  if (blunders(rng) && k.absentSuits.length > 0 && chosen.length > 0) {
    const bad = pick(k.absentSuits, rng);
    if (!chosen.includes(bad)) chosen = [bad, ...chosen.slice(0, count - 1)];
  }

  // Guarantee exactly `count` distinct suits even in degenerate cases.
  if (chosen.length < count) {
    for (const s of SUITS) {
      if (chosen.length >= count) break;
      if (!chosen.includes(s)) chosen.push(s);
    }
  }

  return { type: "guess-suits", suits: chosen.slice(0, count) };
}
