import { describe, expect, it } from "vitest";
import type {
  Card,
  GameRoom,
  Player,
  Rank,
  Suit,
} from "@/shared/types/game";
import { RANKS, SUITS } from "@/shared/types/game";
import { askRank } from "../askRank";
import { collectChests } from "../collectChests";
import { createDeck } from "../createDeck";
import { createRoom } from "../createRoom";
import { finishGame } from "../finishGame";
import { getStateForPlayer } from "../getStateForPlayer";
import { guessAllSuits } from "../guessAllSuits";
import { guessCount } from "../guessCount";
import { guessSuit } from "../guessSuit";
import { joinRoom } from "../joinRoom";
import { shuffleDeck } from "../shuffleDeck";
import { handSizeFor, startGame } from "../startGame";

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function card(rank: Rank, suit: Suit): Card {
  return { id: `${rank}_of_${suit}`, rank, suit };
}

function makePlayer(over: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    socketId: `sock-${over.id}`,
    hand: [],
    chests: [],
    connected: true,
    ...over,
  };
}

function makeRoom(over: Partial<GameRoom> = {}): GameRoom {
  const players: Player[] = over.players ?? [
    makePlayer({ id: "p1", name: "Alice" }),
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
    ...over,
  };
}

function assertOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(
      `expected ok, got error: ${(result as unknown as { error: string }).error}`
    );
  }
  return result as Extract<T, { ok: true }>;
}

describe("createDeck", () => {
  it("has 52 cards", () => {
    expect(createDeck()).toHaveLength(52);
  });

  it("has all unique ids", () => {
    const deck = createDeck();
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(52);
  });

  it("has 4 cards per rank and 13 per suit", () => {
    const deck = createDeck();
    for (const rank of RANKS) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
    }
    for (const suit of SUITS) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
    }
  });
});

describe("shuffleDeck", () => {
  it("preserves all cards (as a set)", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, seededRng(42));
    expect(new Set(shuffled.map((c) => c.id))).toEqual(
      new Set(deck.map((c) => c.id))
    );
  });

  it("is deterministic with same seed", () => {
    const deck = createDeck();
    const a = shuffleDeck(deck, seededRng(42));
    const b = shuffleDeck(deck, seededRng(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("does not mutate the input", () => {
    const deck = createDeck();
    const snapshot = deck.map((c) => c.id);
    shuffleDeck(deck, seededRng(7));
    expect(deck.map((c) => c.id)).toEqual(snapshot);
  });
});

describe("createRoom + joinRoom", () => {
  it("createRoom puts host as the only player", () => {
    const room = createRoom({ hostSocketId: "s1", hostName: "Yury" });
    expect(room.status).toBe("waiting");
    expect(room.players).toHaveLength(1);
    expect(room.players[0].name).toBe("Yury");
    expect(room.hostId).toBe(room.players[0].id);
  });

  it("joinRoom adds players up to 5", () => {
    let room = createRoom({ hostSocketId: "s1", hostName: "A" });
    for (const name of ["B", "C", "D", "E"]) {
      const result = joinRoom(room, { socketId: `sock-${name}`, playerName: name });
      const ok = assertOk(result);
      room = ok.room;
    }
    expect(room.players).toHaveLength(5);
  });

  it("joinRoom rejects 6th player", () => {
    let room = createRoom({ hostSocketId: "s1", hostName: "A" });
    for (const name of ["B", "C", "D", "E"]) {
      const ok = assertOk(
        joinRoom(room, { socketId: `sock-${name}`, playerName: name })
      );
      room = ok.room;
    }
    const sixth = joinRoom(room, { socketId: "sock-F", playerName: "F" });
    expect(sixth.ok).toBe(false);
  });

  it("joinRoom rejects duplicate name", () => {
    let room = createRoom({ hostSocketId: "s1", hostName: "A" });
    const dup = joinRoom(room, { socketId: "sock", playerName: "A" });
    expect(dup.ok).toBe(false);
  });
});

describe("startGame", () => {
  it("deals 7 cards each for 2 players", () => {
    let room = createRoom({ hostSocketId: "s1", hostName: "A" });
    const j = assertOk(joinRoom(room, { socketId: "s2", playerName: "B" }));
    room = j.room;
    const result = assertOk(
      startGame(room, { hostId: room.hostId, rng: seededRng(1) })
    );
    expect(result.room.status).toBe("playing");
    for (const p of result.room.players) {
      expect(p.hand).toHaveLength(7);
    }
    expect(result.room.deck).toHaveLength(52 - 14);
  });

  it("deals 7 cards each for 3 players", () => {
    expect(handSizeFor(3)).toBe(7);
  });

  it("deals 5 cards each for 4 players", () => {
    let room = createRoom({ hostSocketId: "s1", hostName: "A" });
    for (const name of ["B", "C", "D"]) {
      room = assertOk(
        joinRoom(room, { socketId: `s-${name}`, playerName: name })
      ).room;
    }
    const result = assertOk(
      startGame(room, { hostId: room.hostId, rng: seededRng(2) })
    );
    for (const p of result.room.players) {
      expect(p.hand).toHaveLength(5);
    }
    expect(result.room.deck).toHaveLength(52 - 20);
  });

  it("deals 5 cards each for 5 players", () => {
    let room = createRoom({ hostSocketId: "s1", hostName: "A" });
    for (const name of ["B", "C", "D", "E"]) {
      room = assertOk(
        joinRoom(room, { socketId: `s-${name}`, playerName: name })
      ).room;
    }
    const result = assertOk(
      startGame(room, { hostId: room.hostId, rng: seededRng(3) })
    );
    for (const p of result.room.players) {
      expect(p.hand).toHaveLength(5);
    }
    expect(result.room.deck).toHaveLength(52 - 25);
  });

  it("rejects start with 1 player", () => {
    const room = createRoom({ hostSocketId: "s1", hostName: "A" });
    const result = startGame(room, { hostId: room.hostId });
    expect(result.ok).toBe(false);
  });
});

describe("askRank", () => {
  it("rejects if asker has no card of that rank", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({ id: "p2", name: "B", hand: [card("K", "spades")] }),
      ],
    });
    const result = askRank(room, {
      askerId: "p1",
      targetId: "p2",
      rank: "5",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when not asker's turn", () => {
    const room = makeRoom({
      currentPlayerId: "p2",
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({ id: "p2", name: "B", hand: [card("K", "spades")] }),
      ],
    });
    const result = askRank(room, {
      askerId: "p1",
      targetId: "p2",
      rank: "7",
    });
    expect(result.ok).toBe(false);
  });

  it("MISS at rank level: asker draws + turn passes", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({ id: "p2", name: "B", hand: [card("K", "spades")] }),
      ],
      deck: [card("3", "diamonds")],
    });
    const ok = assertOk(
      askRank(room, { askerId: "p1", targetId: "p2", rank: "7" })
    );
    expect(ok.room.currentPlayerId).toBe("p2");
    expect(ok.room.pendingGuess).toBeNull();
    const p1 = ok.room.players.find((p) => p.id === "p1")!;
    expect(p1.hand.some((c) => c.id === "3_of_diamonds")).toBe(true);
    expect(ok.room.deck).toHaveLength(0);
  });

  it("HIT at rank level: pendingGuess awaiting-detail, turn unchanged", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("7", "spades"), card("K", "hearts")],
        }),
      ],
    });
    const ok = assertOk(
      askRank(room, { askerId: "p1", targetId: "p2", rank: "7" })
    );
    expect(ok.room.currentPlayerId).toBe("p1");
    expect(ok.room.pendingGuess).toEqual({
      stage: "awaiting-detail",
      askerId: "p1",
      targetId: "p2",
      rank: "7",
    });
  });
});

describe("guessSuit", () => {
  function setupHit(): GameRoom {
    return makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("7", "spades"), card("K", "hearts")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "p1",
        targetId: "p2",
        rank: "7",
      },
    });
  }

  it("HIT: takes card and turn continues", () => {
    const room = setupHit();
    const ok = assertOk(guessSuit(room, { askerId: "p1", suit: "spades" }));
    expect(ok.room.currentPlayerId).toBe("p1");
    expect(ok.room.pendingGuess).toBeNull();
    const p1 = ok.room.players.find((p) => p.id === "p1")!;
    const p2 = ok.room.players.find((p) => p.id === "p2")!;
    expect(p1.hand.some((c) => c.id === "7_of_spades")).toBe(true);
    expect(p2.hand.some((c) => c.id === "7_of_spades")).toBe(false);
  });

  it("MISS: reveals absent suit, draws, passes turn", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("7", "spades"), card("K", "hearts")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "p1",
        targetId: "p2",
        rank: "7",
      },
      deck: [card("A", "clubs")],
    });
    const ok = assertOk(guessSuit(room, { askerId: "p1", suit: "diamonds" }));
    expect(ok.room.currentPlayerId).toBe("p2");
    expect(ok.room.pendingGuess).toBeNull();
    const p1 = ok.room.players.find((p) => p.id === "p1")!;
    expect(p1.hand.some((c) => c.id === "A_of_clubs")).toBe(true);
  });

  it("HIT that completes a chest: 4 cards auto-collected", () => {
    const room = makeRoom({
      players: [
        makePlayer({
          id: "p1",
          name: "A",
          hand: [
            card("7", "hearts"),
            card("7", "diamonds"),
            card("7", "clubs"),
          ],
        }),
        makePlayer({ id: "p2", name: "B", hand: [card("7", "spades")] }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "p1",
        targetId: "p2",
        rank: "7",
      },
    });
    const ok = assertOk(guessSuit(room, { askerId: "p1", suit: "spades" }));
    const p1 = ok.room.players.find((p) => p.id === "p1")!;
    expect(p1.chests).toContain("7");
    expect(p1.hand.filter((c) => c.rank === "7")).toHaveLength(0);
  });
});

describe("guessCount + guessAllSuits", () => {
  it("correct count → awaiting-suits", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("7", "spades"), card("7", "clubs")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "p1",
        targetId: "p2",
        rank: "7",
      },
    });
    const ok = assertOk(guessCount(room, { askerId: "p1", count: 2 }));
    expect(ok.room.pendingGuess).toEqual({
      stage: "awaiting-suits",
      askerId: "p1",
      targetId: "p2",
      rank: "7",
      count: 2,
    });
  });

  it("wrong count → draw + pass turn", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("7", "spades"), card("7", "clubs")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "p1",
        targetId: "p2",
        rank: "7",
      },
      deck: [card("J", "diamonds")],
    });
    const ok = assertOk(guessCount(room, { askerId: "p1", count: 1 }));
    expect(ok.room.currentPlayerId).toBe("p2");
    expect(ok.room.pendingGuess).toBeNull();
  });

  it("guessAllSuits correct → all cards transferred + chest auto-collected", () => {
    const room = makeRoom({
      players: [
        makePlayer({
          id: "p1",
          name: "A",
          hand: [card("7", "hearts"), card("7", "diamonds")],
        }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("7", "spades"), card("7", "clubs")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-suits",
        askerId: "p1",
        targetId: "p2",
        rank: "7",
        count: 2,
      },
    });
    const ok = assertOk(
      guessAllSuits(room, {
        askerId: "p1",
        suits: ["spades", "clubs"],
      })
    );
    const p1 = ok.room.players.find((p) => p.id === "p1")!;
    expect(p1.chests).toContain("7");
    expect(p1.hand.filter((c) => c.rank === "7")).toHaveLength(0);
    expect(ok.room.currentPlayerId).toBe("p1");
  });

  it("guessAllSuits wrong suit → draw + pass turn", () => {
    const room = makeRoom({
      players: [
        makePlayer({
          id: "p1",
          name: "A",
          hand: [card("7", "hearts"), card("7", "diamonds")],
        }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("7", "spades"), card("7", "clubs")],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-suits",
        askerId: "p1",
        targetId: "p2",
        rank: "7",
        count: 2,
      },
      deck: [card("J", "diamonds")],
    });
    const ok = assertOk(
      guessAllSuits(room, {
        askerId: "p1",
        suits: ["spades", "hearts"],
      })
    );
    expect(ok.room.currentPlayerId).toBe("p2");
    expect(ok.room.pendingGuess).toBeNull();
  });
});

describe("collectChests", () => {
  it("collects 4 of a rank", () => {
    const room = makeRoom({
      players: [
        makePlayer({
          id: "p1",
          name: "A",
          hand: SUITS.map((s) => card("9", s)),
        }),
        makePlayer({ id: "p2", name: "B" }),
      ],
    });
    const { room: next, collected } = collectChests(room, "p1");
    expect(collected).toEqual(["9"]);
    const p1 = next.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(0);
    expect(p1.chests).toEqual(["9"]);
  });

  it("does nothing for 3 of a rank", () => {
    const room = makeRoom({
      players: [
        makePlayer({
          id: "p1",
          name: "A",
          hand: [card("9", "hearts"), card("9", "spades"), card("9", "clubs")],
        }),
        makePlayer({ id: "p2", name: "B" }),
      ],
    });
    const { collected } = collectChests(room, "p1");
    expect(collected).toEqual([]);
  });
});

describe("getStateForPlayer", () => {
  it("never exposes other players' hands", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", hand: [card("7", "hearts")] }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("K", "spades"), card("3", "diamonds")],
        }),
      ],
    });
    const state = getStateForPlayer(room, "p1");
    expect(state).not.toBeNull();
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("K_of_spades");
    expect(serialized).not.toContain("3_of_diamonds");
    expect(state!.me.hand).toHaveLength(1);
    expect(state!.players.find((p) => p.id === "p2")!.cardsCount).toBe(2);
  });

  it("exposes deck count but not deck contents", () => {
    const room = makeRoom({
      deck: [card("A", "spades"), card("Q", "hearts")],
    });
    const state = getStateForPlayer(room, "p1")!;
    expect(state.deckCount).toBe(2);
    expect(JSON.stringify(state)).not.toContain("A_of_spades");
  });
});

describe("finishGame", () => {
  it("picks player with the most chests", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", chests: ["7", "K"] }),
        makePlayer({ id: "p2", name: "B", chests: ["3"] }),
      ],
    });
    const { room: finished } = finishGame(room);
    expect(finished.status).toBe("finished");
    expect(finished.winnerIds).toEqual(["p1"]);
    expect(finished.currentPlayerId).toBeNull();
  });

  it("returns multiple winners on tie", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "A", chests: ["7"] }),
        makePlayer({ id: "p2", name: "B", chests: ["K"] }),
      ],
    });
    const { room: finished } = finishGame(room);
    expect(finished.winnerIds.sort()).toEqual(["p1", "p2"]);
  });
});

describe("full game ends when all chests collected", () => {
  it("status becomes finished when 13 chests collected", () => {
    const chestsByPlayer: Rank[][] = [
      ["2", "3", "4", "5", "6", "7"],
      ["8", "9", "10", "J", "Q", "K"],
    ];
    const room = makeRoom({
      players: [
        makePlayer({
          id: "p1",
          name: "A",
          hand: [card("A", "hearts"), card("A", "diamonds"), card("A", "clubs")],
          chests: chestsByPlayer[0],
        }),
        makePlayer({
          id: "p2",
          name: "B",
          hand: [card("A", "spades")],
          chests: chestsByPlayer[1],
        }),
      ],
      pendingGuess: {
        stage: "awaiting-detail",
        askerId: "p1",
        targetId: "p2",
        rank: "A",
      },
    });
    const ok = assertOk(guessSuit(room, { askerId: "p1", suit: "spades" }));
    expect(ok.room.status).toBe("finished");
    expect(ok.room.winnerIds).toEqual(["p1"]);
  });
});
