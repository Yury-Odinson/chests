/**
 * The draw pile shown on the table. While the deck has cards we render the
 * card back with a count badge; once it's empty we keep a same-sized dashed
 * placeholder (so the layout doesn't jump) showing 0.
 */
export function DeckPile({ count }: { count: number }) {
  const empty = count === 0;

  return (
    <div
      data-anchor="deck"
      className="game-deck pointer-events-none absolute z-30 flex flex-col items-center gap-1"
    >
      <div className="game-deck-card relative">
        {empty ? (
          <div className="flex h-full w-full items-center justify-center rounded-[10px] border-2 border-dashed border-amber-100/25 bg-stone-950/35">
            <span className="text-[11px] uppercase tracking-wide text-amber-50/45">
              пусто
            </span>
          </div>
        ) : (
          <>
            {/* A couple of offset layers hint at a stack of cards. */}
            <span className="absolute inset-0 translate-x-1 translate-y-1 rounded-[10px] bg-stone-950/55" />
            <span className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-[10px] bg-stone-950/45" />
            <img
              src="/card-back.webp"
              alt="Колода"
              className="relative h-full w-full rounded-[10px] object-cover shadow-[0_10px_28px_rgba(0,0,0,0.5)]"
              draggable={false}
            />
          </>
        )}
        <span
          className={[
            "absolute -bottom-2 -right-2 grid min-w-7 place-items-center rounded-full border px-1.5 py-0.5 text-sm font-bold shadow-lg",
            empty
              ? "border-amber-100/20 bg-stone-900/85 text-amber-50/60"
              : "border-amber-200/50 bg-amber-300 text-stone-950",
          ].join(" ")}
        >
          {count}
        </span>
      </div>
      <span className="text-[11px] uppercase tracking-wide text-amber-50/55">
        колода
      </span>
    </div>
  );
}
