import type { PublicPlayer } from "@/shared/types/game";
import { ChestsList } from "./ChestsList";
import { PlayingCard } from "./PlayingCard";

interface OpponentTileProps {
  player: PublicPlayer;
  isCurrent: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function OpponentTile({
  player,
  isCurrent,
  isSelectable,
  isSelected,
  onSelect,
}: OpponentTileProps) {
  const cards = Array.from({ length: Math.min(player.cardsCount, 8) });
  const Wrapper = isSelectable ? "button" : "div";
  return (
    <Wrapper
      type={isSelectable ? "button" : undefined}
      onClick={isSelectable ? onSelect : undefined}
      disabled={isSelectable ? false : undefined}
      className={[
        "flex flex-col gap-2 rounded-xl border bg-[var(--card-bg)] p-3 text-left transition",
        isCurrent
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
          : "border-[var(--card-border)]",
        isSelectable ? "cursor-pointer hover:border-[var(--accent)]" : "",
        isSelected ? "ring-2 ring-[var(--accent)]" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={[
              "inline-block h-2 w-2 rounded-full",
              player.connected ? "bg-emerald-500" : "bg-zinc-400",
            ].join(" ")}
            title={player.connected ? "онлайн" : "офлайн"}
          />
          <span className="font-medium">{player.name}</span>
          {player.isHost && (
            <span className="text-xs opacity-60">(хост)</span>
          )}
        </div>
        <span className="text-xs opacity-60">{player.cardsCount} карт</span>
      </div>

      <div className="flex flex-wrap items-end gap-[-12px]">
        {cards.map((_, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : -28 }}>
            <PlayingCard faceDown />
          </div>
        ))}
        {player.cardsCount > 8 && (
          <span className="self-end pl-2 text-xs opacity-60">
            +{player.cardsCount - 8}
          </span>
        )}
      </div>

      <ChestsList chests={player.chests} />
    </Wrapper>
  );
}
