import type {
  ClientGameState,
  GameLogItem,
  Rank,
  RoomSummary,
  Suit,
} from "./game";

export interface RoomCreatePayload {
  playerName: string;
}
export interface RoomJoinPayload {
  roomId: string;
  playerName: string;
}
export interface RoomRejoinPayload {
  roomId: string;
  playerId: string;
}
export interface RoomLeavePayload {
  roomId: string;
}
export interface RoomStartPayload {
  roomId: string;
}
export interface RoomFinishPayload {
  roomId: string;
}
export interface RoomAddBotPayload {
  roomId: string;
}
export interface RoomKickPayload {
  roomId: string;
  targetPlayerId: string;
}
export interface GameAskRankPayload {
  roomId: string;
  targetPlayerId: string;
  rank: Rank;
}
export interface GameGuessCountPayload {
  roomId: string;
  count: number;
}
export interface GameGuessSuitsPayload {
  roomId: string;
  suits: Suit[];
}

export interface RoomListPayload {
  rooms: RoomSummary[];
}

export interface RoomCreatedPayload {
  roomId: string;
  playerId: string;
}
export interface RoomJoinedPayload {
  roomId: string;
  playerId: string;
}
export interface GameErrorPayload {
  message: string;
}

export interface ClientToServerEvents {
  "lobby:join": () => void;
  "lobby:leave": () => void;
  "room:create": (payload: RoomCreatePayload) => void;
  "room:join": (payload: RoomJoinPayload) => void;
  "room:rejoin": (payload: RoomRejoinPayload) => void;
  "room:leave": (payload: RoomLeavePayload) => void;
  "room:start": (payload: RoomStartPayload) => void;
  "room:finish": (payload: RoomFinishPayload) => void;
  "room:add-bot": (payload: RoomAddBotPayload) => void;
  "room:kick": (payload: RoomKickPayload) => void;
  "game:ask-rank": (payload: GameAskRankPayload) => void;
  "game:guess-count": (payload: GameGuessCountPayload) => void;
  "game:guess-suits": (payload: GameGuessSuitsPayload) => void;
}

export interface ServerToClientEvents {
  "room:list": (payload: RoomListPayload) => void;
  "room:created": (payload: RoomCreatedPayload) => void;
  "room:joined": (payload: RoomJoinedPayload) => void;
  "session:invalid": () => void;
  "room:kicked": () => void;
  "game:state": (state: ClientGameState) => void;
  "game:log": (item: GameLogItem) => void;
  "game:error": (payload: GameErrorPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  playerId?: string;
  roomId?: string;
}
