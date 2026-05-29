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
}

export interface PublicPlayer {
  id: string;
  name: string;
  cardsCount: number;
  chests: Rank[];
  connected: boolean;
  isHost: boolean;
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
