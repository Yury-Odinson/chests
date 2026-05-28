import { RANKS, SUITS, type Card } from "@/shared/types/game";

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({
        id: `${rank}_of_${suit}`,
        rank,
        suit,
      });
    }
  }
  return deck;
}
