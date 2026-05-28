import type { Card, Suit, Rank } from "@/shared/types/game";

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_LABEL: Record<Suit, string> = {
  hearts: "червы",
  diamonds: "бубны",
  clubs: "трефы",
  spades: "пики",
};

function suitColor(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds"
    ? "text-red-600 dark:text-red-400"
    : "text-zinc-800 dark:text-zinc-100";
}

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

export function PlayingCard({
  card,
  faceDown,
  onClick,
  selected,
  disabled,
}: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div className="flex h-20 w-14 items-center justify-center rounded-md border border-emerald-900/40 bg-gradient-to-br from-emerald-700 to-emerald-900 text-emerald-100/60 shadow-sm select-none">
        <span className="text-2xl">♠</span>
      </div>
    );
  }

  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={[
        "flex h-20 w-14 flex-col items-center justify-between rounded-md border bg-white px-1 py-1 shadow-sm transition",
        selected
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
          : "border-zinc-300",
        clickable
          ? "cursor-pointer hover:-translate-y-1 hover:shadow-md active:translate-y-0"
          : "",
        suitColor(card.suit),
      ].join(" ")}
    >
      <span className="self-start text-sm font-semibold leading-none">
        {card.rank}
      </span>
      <span className="text-2xl leading-none">{SUIT_SYMBOL[card.suit]}</span>
      <span className="self-end text-sm font-semibold leading-none rotate-180">
        {card.rank}
      </span>
    </button>
  );
}

export function rankBadge(rank: Rank): string {
  return rank;
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

export function suitLabel(suit: Suit): string {
  return SUIT_LABEL[suit];
}

export function suitColorClass(suit: Suit): string {
  return suitColor(suit);
}
