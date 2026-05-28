import type { Card } from "@/shared/types/game";
import type { Rng } from "./types";

export function shuffleDeck(deck: Card[], rng: Rng = Math.random): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
