import type { Card, Rank } from "@/shared/types/game";
import { RANKS } from "@/shared/types/game";
import { PlayingCard } from "./PlayingCard";

export function MyHand({ hand }: { hand: Card[] }) {
  if (hand.length === 0) {
    return (
      <p className="text-sm opacity-60">У вас нет карт на руке.</p>
    );
  }
  const sorted = [...hand].sort((a, b) => {
    const r = RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
    if (r !== 0) return r;
    return a.suit.localeCompare(b.suit);
  });

  // Group adjacent same-rank cards for slight visual grouping
  const grouped: Card[][] = [];
  for (const card of sorted) {
    const last = grouped[grouped.length - 1];
    if (last && last[0].rank === card.rank) {
      last.push(card);
    } else {
      grouped.push([card]);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {grouped.map((group, gi) => (
        <div key={`${group[0].rank}-${gi}`} className="flex gap-1">
          {group.map((c) => (
            <PlayingCard key={c.id} card={c} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ranksFromHand(hand: Card[]): Rank[] {
  const set = new Set(hand.map((c) => c.rank));
  return RANKS.filter((r) => set.has(r));
}
