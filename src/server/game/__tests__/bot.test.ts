import { describe, expect, it } from "vitest";
import type {
  Card,
  GameRoom,
  Player,
  Rank,
  Suit,
} from "@/shared/types/game";
import { addBot } from "../addBot";
import { askRank } from "../askRank";
import { decideBotAction } from "../botBrain";
import { getKnowledge } from "../botMemory";
import { createRoom } from "../createRoom";
import { guessCount } from "../guessCount";
import { guessSuit } from "../guessSuit";

function card(rank: Rank, suit: Suit): Card {
  return { id: `${rank}_of_${suit}`, rank, suit };
}

function makePlayer(
  over: Partial<Player> & Pick<Player, "id" | "name">
): Player {
  return {
    socketId: `sock-${over.id}`,
    hand: [],
    chests: [],
    connected: true,
    isBot: false,
    ...over,
  };
}

function makeRoom(over: Partial<GameRoom> = {}): GameRoom {
  const players: Player[] = over.players ?? [
    makePlayer({ id: "bot", name: "Bot", isBot: true }),
    makePlayer({ id: "p2", name: "Bob" }),
  ];
  return {
    id: "TEST01",
    status: "playing",
    hostId: players[0].id,
    players,
    deck: [],
    currentPlayerId: players[0].id,
    pendingGuess: null,
    winnerIds: [],
    log: [],
    createdAt: "2026-05-28T00:00:00Z",
    botMemory: {},
    ...over,
  };
}

// 0.12 is ≥ 1/9 (so blunders() is false) yet small enough that
// pick() = floor(0.12 * len) selects index 0 for any realistic len (≤ 8).
/** Rng that never triggers the 1/9 blunder and always picks the first item. */
const steadyRng = () => 0.12;

function assertOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(
      `expected ok, got: ${(result as unknown as { error: string }).error}`
    );
  }
  return result as Extract<T, { ok: true }>;
}

describe("addBot", () => {
  it("host can add a bot to a waiting room", () => {
    const room = createRoom({ hostSocketId: "s1", hostName: "Host" });
    const ok = assertOk(addBot(room, { hostId: room.hostId }));
    expect(ok.room.players).toHaveLength(2);
    const bot = ok.room.players[1];
    expect(bot.isBot).toBe(true);
    expect(bot.socketId).toBeNull();
    expect(bot.connected).toBe(true);
  });

  it("non-host cannot add a bot", () => {
    const room = createRoom({ hostSocketId: "s1", hostName: "Host" });
    const res = addBot(room, { hostId: "someone-else" });
    expect(res.ok).toBe(false);
  });

  it("cannot add a bot once playing", () => {
    const room = makeRoom({ status: "playing" });
    const res = addBot(room, { hostId: room.hostId });
    expect(res.ok).toBe(false);
  });

  it("bot names stay unique", () => {
    let room = createRoom({ hostSocketId: "s1", hostName: "Host" });
    const names = new Set<string>();
    for (let i = 0; i < 4; i++) {
      room = assertOk(addBot(room, { hostId: room.hostId })).room;
      names.add(room.players[room.players.length - 1].name);
    }
    expect(names.size).toBe(4);
  });
});

describe("bot brain: stage 1 (ask)", () => {
  it("only asks ranks it holds", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [card("7", "hearts")] }),
        makePlayer({ id: "p2", name: "Bob", hand: [card("K", "spades")] }),
      ],
    });
    const action = decideBotAction(room, "bot", steadyRng);
    expect(action).toEqual({ type: "ask-rank", targetId: "p2", rank: "7" });
  });

  it("chases a target memory says still holds a rank the bot also holds", () => {
    // Bot holds 7 and K; memory knows p3 has a K. It should target p3 for K.
    const room = makeRoom({
      players: [
        makePlayer({
          id: "bot",
          name: "Bot",
          isBot: true,
          hand: [card("7", "hearts"), card("K", "clubs")],
        }),
        makePlayer({ id: "p2", name: "Bob", hand: [card("3", "spades")] }),
        makePlayer({ id: "p3", name: "Cara", hand: [card("K", "spades")] }),
      ],
      botMemory: {
        bot: { p3: { K: { knownPresent: true, knownAbsent: false, absentSuits: [], triedCounts: [], revealedCount: null } } },
      },
    });
    const action = decideBotAction(room, "bot", steadyRng);
    expect(action).toEqual({ type: "ask-rank", targetId: "p3", rank: "K" });
  });

  it("returns null when the bot has no cards", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [] }),
        makePlayer({ id: "p2", name: "Bob", hand: [card("K", "spades")] }),
      ],
    });
    expect(decideBotAction(room, "bot", steadyRng)).toBeNull();
  });
});

describe("bot brain: stage 2 (detail)", () => {
  function pending(over: Partial<GameRoom> = {}): GameRoom {
    return makeRoom({
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "Bob",
          hand: [card("7", "spades"), card("7", "clubs")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "bot",
        targetId: "p2",
        rank: "7",
      },
      ...over,
    });
  }

  it("guesses a single suit when count is uncertain", () => {
    const action = decideBotAction(pending(), "bot", steadyRng);
    expect(action?.type).toBe("guess-suit");
    if (action?.type === "guess-suit") {
      // Never names a suit the bot itself holds (hearts).
      expect(action.suit).not.toBe("hearts");
    }
  });

  it("goes for count when the exact count was revealed", () => {
    const room = pending({
      botMemory: {
        bot: { p2: { "7": { knownPresent: true, knownAbsent: false, absentSuits: [], triedCounts: [], revealedCount: 2 } } },
      },
    });
    const action = decideBotAction(room, "bot", steadyRng);
    expect(action).toEqual({ type: "guess-count", count: 2 });
  });

  it("does not name a suit already revealed absent", () => {
    const room = pending({
      botMemory: {
        bot: { p2: { "7": { knownPresent: true, knownAbsent: false, absentSuits: ["spades"], triedCounts: [], revealedCount: null } } },
      },
    });
    const action = decideBotAction(room, "bot", steadyRng);
    if (action?.type === "guess-suit") {
      expect(action.suit).not.toBe("spades");
      expect(action.suit).not.toBe("hearts");
    }
  });
});

describe("bot memory: observation from real engine flow", () => {
  it("records knownPresent after a rank ask hits", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "Bob",
          hand: [card("7", "spades"), card("K", "hearts")],
        }),
      ],
    });
    const ok = assertOk(askRank(room, { askerId: "bot", targetId: "p2", rank: "7" }));
    const k = getKnowledge(ok.room.botMemory, "bot", "p2", "7");
    expect(k.knownPresent).toBe(true);
  });

  it("remembers a wrong count and the revealed actual", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "Bob",
          hand: [card("7", "spades"), card("7", "clubs")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "bot",
        targetId: "p2",
        rank: "7",
      },
      deck: [card("J", "diamonds")],
    });
    const ok = assertOk(guessCount(room, { askerId: "bot", count: 1 }));
    const k = getKnowledge(ok.room.botMemory, "bot", "p2", "7");
    expect(k.triedCounts).toContain(1);
    expect(k.revealedCount).toBe(2);
  });

  it("a watching bot learns an absent suit from another player's miss", () => {
    // p2 is the asker (human); bot just watches. The bot should still learn
    // that p3 lacks 7 of diamonds.
    const room = makeRoom({
      currentPlayerId: "p2",
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [card("7", "hearts")] }),
        makePlayer({ id: "p2", name: "Bob", hand: [card("7", "clubs")] }),
        makePlayer({ id: "p3", name: "Cara", hand: [card("7", "spades")] }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "p2",
        targetId: "p3",
        rank: "7",
      },
      deck: [card("A", "clubs")],
    });
    const ok = assertOk(guessSuit(room, { askerId: "p2", suit: "diamonds" }));
    const k = getKnowledge(ok.room.botMemory, "bot", "p3", "7");
    expect(k.absentSuits).toContain("diamonds");
  });

  it("forgets a rank for a target after its cards are taken", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "Bob",
          hand: [card("7", "spades"), card("K", "hearts")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "bot",
        targetId: "p2",
        rank: "7",
      },
      botMemory: {
        bot: { p2: { "7": { knownPresent: true, knownAbsent: false, absentSuits: ["clubs"], triedCounts: [3], revealedCount: 1 } } },
      },
    });
    const ok = assertOk(guessSuit(room, { askerId: "bot", suit: "spades" }));
    const k = getKnowledge(ok.room.botMemory, "bot", "p2", "7");
    expect(k.knownPresent).toBe(false);
    expect(k.revealedCount).toBeNull();
    expect(k.triedCounts).toEqual([]);
  });
});

describe("bot brain: requirement #1 — retries a different count", () => {
  it("after a wrong count, the next count guess avoids the tried one", () => {
    // Target holds three 7s; bot holds none. Bot first guesses wrong, then on
    // the follow-up should try a different (untried) count.
    const room = makeRoom({
      players: [
        makePlayer({ id: "bot", name: "Bot", isBot: true, hand: [card("K", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "Bob",
          hand: [card("7", "spades"), card("7", "clubs"), card("7", "diamonds")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "bot",
        targetId: "p2",
        rank: "7",
      },
      botMemory: {
        // Already tried count 1 (wrong); real revealed count is 3.
        bot: { p2: { "7": { knownPresent: true, knownAbsent: false, absentSuits: [], triedCounts: [1], revealedCount: 3 } } },
      },
    });
    const action = decideBotAction(room, "bot", steadyRng);
    // revealedCount 3 is known and untried → bot should name 3.
    expect(action).toEqual({ type: "guess-count", count: 3 });
  });
});
