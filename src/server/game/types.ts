import type { GameLogItem, GameRoom } from "@/shared/types/game";

export type EngineResult =
  | { ok: true; room: GameRoom; logs: GameLogItem[] }
  | { ok: false; error: string };

export type Rng = () => number;
