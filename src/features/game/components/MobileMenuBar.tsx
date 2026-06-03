"use client";

import { useEffect, useRef } from "react";
import type { GameLogItem, GameLogKind } from "@/shared/types/game";

/**
 * Compact top bar for the mobile layouts: action buttons on the left, a
 * horizontal "ticker" log on the right. Replaces the absolute desktop Header
 * and the collapsible log strip on phones.
 *
 * In `stacked` (portrait) mode the bar also hosts the chest counter and the
 * deck pile so the play area below stays uncluttered: the first row reads
 * `[сундуки] [колода] … [Завершить] [Выйти]`, with the log on its own row.
 */
export function MobileMenuBar({
  isHost,
  canFinish,
  onFinish,
  onLeave,
  log,
  stacked = false,
  totalChests,
  deckCount,
}: {
  isHost: boolean;
  canFinish: boolean;
  onFinish: () => void;
  onLeave: () => void;
  log: GameLogItem[];
  /** Portrait: buttons on top, log on its own row below. */
  stacked?: boolean;
  /** Collected chests so far (out of 13). Shown in stacked mode. */
  totalChests?: number;
  /** Remaining deck size. Renders the deck pile in stacked mode. */
  deckCount?: number;
}) {
  const buttons = (
    <div className="flex shrink-0 items-center gap-1.5">
      {isHost && canFinish && (
        <button
          type="button"
          onClick={onFinish}
          className="rounded-md border border-red-300/60 px-2.5 py-1 text-xs text-red-100 transition hover:border-red-200 hover:bg-red-950/30"
        >
          Завершить
        </button>
      )}
      <button
        type="button"
        onClick={onLeave}
        className="rounded-md border border-amber-100/20 px-2.5 py-1 text-xs text-amber-50/82 transition hover:border-amber-200/70 hover:text-amber-50"
      >
        Выйти
      </button>
    </div>
  );

  if (stacked) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-amber-100/20 bg-[#160f0b]/85 px-2 py-1.5 text-amber-50 shadow-lg backdrop-blur-[3px]">
        <div className="flex items-center gap-2">
          {typeof totalChests === "number" && (
            <span className="shrink-0 whitespace-nowrap text-xs">
              <span className="text-amber-100/60">сундуки:</span>{" "}
              <span className="font-semibold">{totalChests}/13</span>
            </span>
          )}
          {typeof deckCount === "number" && <MenuDeck count={deckCount} />}
          <span className="ml-auto" />
          {buttons}
        </div>
        <TickerLog items={log} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-100/20 bg-[#160f0b]/85 px-2 py-1.5 text-amber-50 shadow-lg backdrop-blur-[3px]">
      {buttons}
      <span className="h-6 w-px shrink-0 bg-amber-100/15" />
      <TickerLog items={log} />
    </div>
  );
}

/**
 * Compact deck pile for the menu bar. Carries the `data-anchor="deck"` attr so
 * the shared CardFlightLayer keeps animating draws to/from here.
 */
function MenuDeck({ count }: { count: number }) {
  const empty = count === 0;
  return (
    <div data-anchor="deck" className="flex shrink-0 items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-amber-50/55">
        колода
      </span>
      <div className="relative h-10 w-7">
        {empty ? (
          <div className="flex h-full w-full items-center justify-center rounded-[5px] border-2 border-dashed border-amber-100/25 bg-stone-950/35 text-[8px] uppercase text-amber-50/45">
            пусто
          </div>
        ) : (
          <img
            src="/card-back.webp"
            alt="Колода"
            className="h-full w-full rounded-[5px] object-cover shadow-md"
            draggable={false}
          />
        )}
        <span
          className={[
            "absolute -bottom-1.5 -right-1.5 grid min-w-4.5 place-items-center rounded-full border px-1 text-[10px] font-bold shadow",
            empty
              ? "border-amber-100/20 bg-stone-900/85 text-amber-50/60"
              : "border-amber-200/50 bg-amber-300 text-stone-950",
          ].join(" ")}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

const TICKER_KIND_CLASS: Record<GameLogKind, string> = {
  neutral: "border-amber-100/18 bg-stone-950/45 text-amber-50/88",
  info: "border-sky-300/30 bg-sky-950/40 text-sky-100",
  success: "border-emerald-300/30 bg-emerald-950/40 text-emerald-100",
  error: "border-red-300/35 bg-red-950/45 text-red-100",
  muted: "border-amber-100/12 bg-stone-950/35 text-amber-50/55",
};

const MAX_TICKER_ITEMS = 5;

/**
 * Horizontal running log. The newest entry occupies the far-left slot and
 * slides in from the right; older entries shift rightward and the 6th oldest
 * drops off. Overflow scrolls horizontally.
 *
 * `items` is the full log (oldest→newest). We take the last few and reverse
 * them so the newest is first (leftmost). Each entry is keyed by id, so when a
 * new one arrives only its (brand-new) leftmost node mounts and plays the
 * slide-in keyframe once; the shifted older nodes are reused and don't replay.
 */
function TickerLog({ items }: { items: GameLogItem[] }) {
  const recent = items.slice(-MAX_TICKER_ITEMS).reverse();
  const newest = recent[0];
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the newest (leftmost) entry in view when it changes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [newest?.id]);

  if (recent.length === 0) {
    return (
      <div className="flex-1 truncate text-[11px] text-amber-50/45">
        События появятся здесь.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
    >
      {recent.map((item, index) => (
        <span
          key={item.id}
          className={[
            "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] leading-tight",
            TICKER_KIND_CLASS[item.kind] ?? TICKER_KIND_CLASS.neutral,
            index === 0 ? "ticker-entry-new" : "",
          ].join(" ")}
        >
          {stripMarkdown(item.message)}
        </span>
      ))}
    </div>
  );
}

function stripMarkdown(message: string): string {
  return message.replace(/\*\*([^*]+)\*\*/g, "$1");
}
