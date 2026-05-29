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
  size?: "default" | "small";
}

export function PlayingCard({
  card,
  faceDown,
  onClick,
  selected,
  disabled,
  size = "default",
}: PlayingCardProps) {
  const cardSizeClass = size === "small" ? "h-16 w-11" : "h-20 w-14";
  const rankSizeClass = size === "small" ? "text-xs" : "text-sm";
  const suitSizeClass = size === "small" ? "text-xl" : "text-2xl";

  if (faceDown || !card) {
    return (
      <div
        className={`flex ${cardSizeClass} items-center justify-center rounded-md border border-emerald-900/40 bg-gradient-to-br from-emerald-700 to-emerald-900 text-emerald-100/60 shadow-sm select-none`}
      >
        <span className={suitSizeClass}>♠</span>
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
        `flex ${cardSizeClass} flex-col items-center justify-between rounded-md border bg-white px-1 py-1 shadow-sm transition`,
        selected
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
          : "border-zinc-300",
        clickable
          ? "cursor-pointer hover:-translate-y-1 hover:shadow-md active:translate-y-0"
          : "",
        suitColor(card.suit),
      ].join(" ")}
    >
      <span className={`self-start ${rankSizeClass} font-semibold leading-none`}>
        {card.rank}
      </span>
      <span className={`${suitSizeClass} leading-none`}>
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span
        className={`self-end ${rankSizeClass} font-semibold leading-none rotate-180`}
      >
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
