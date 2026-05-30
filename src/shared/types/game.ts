export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export const SUITS: readonly Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: readonly Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export type GameStatus = "waiting" | "playing" | "finished";

export interface Player {
  id: string;
  socketId: string | null;
  name: string;
  hand: Card[];
  chests: Rank[];
  connected: boolean;
  isBot: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  cardsCount: number;
  chests: Rank[];
  connected: boolean;
  isHost: boolean;
  isBot: boolean;
}

export type PendingGuess =
  | {
      stage: "awaiting-detail";
      askerId: string;
      targetId: string;
      rank: Rank;
    }
  | {
      stage: "awaiting-suits";
      askerId: string;
      targetId: string;
      rank: Rank;
      count: number;
    };

export type GameLogKind =
  | "neutral"
  | "info"
  | "success"
  | "error"
  | "muted";

export interface GameLogItem {
  id: string;
  createdAt: string;
  message: string;
  kind: GameLogKind;
}

/**
 * What the bots have deduced from public play about a single (target, rank)
 * pair. Everything here is information a human watching the table would also
 * know — it never includes hidden hands. Lives on the room (server-only) and
 * is never sent to clients.
 */
export interface RankKnowledge {
  /** Target was publicly shown to hold ≥1 of this rank (asker got a "yes"). */
  knownPresent: boolean;
  /** Target was publicly shown to hold none of this rank. */
  knownAbsent: boolean;
  /** Suits of this rank publicly revealed as ABSENT from the target. */
  absentSuits: Suit[];
  /** Counts already named for this (target, rank) that turned out wrong. */
  triedCounts: number[];
  /** Exact count of this rank publicly revealed for the target, if any. */
  revealedCount: number | null;
}

/**
 * Per-bot memory across the whole game. Keyed by botId → targetId → rank.
 * Records both the bot's own past guesses and everything it observed other
 * players do (failed guesses reveal info the bot can exploit).
 */
export interface BotMemory {
  [botId: string]: {
    [targetId: string]: {
      [rank: string]: RankKnowledge;
    };
  };
}

export interface GameRoom {
  id: string;
  status: GameStatus;
  hostId: string;
  players: Player[];
  deck: Card[];
  currentPlayerId: string | null;
  pendingGuess: PendingGuess | null;
  winnerIds: string[];
  log: GameLogItem[];
  createdAt: string;
  /** Server-only deductions used by bot players. Never sent to clients. */
  botMemory: BotMemory;
}

export interface RoomSummary {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: GameStatus;
}

export interface ClientGameState {
  roomId: string;
  status: GameStatus;
  hostId: string;
  currentPlayerId: string | null;
  deckCount: number;
  me: {
    id: string;
    name: string;
    hand: Card[];
    chests: Rank[];
  };
  players: PublicPlayer[];
  pendingGuess: PendingGuess | null;
  winnerIds: string[];
  log: GameLogItem[];
}
