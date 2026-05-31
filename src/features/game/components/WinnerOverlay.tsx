"use client";

import type { ClientGameState } from "@/shared/types/game";

export function WinnerOverlay({
  state,
  onClose,
}: {
  state: ClientGameState;
  onClose: () => void;
}) {
  const winners = state.players.filter((p) => state.winnerIds.includes(p.id));
  const youWon = winners.some((p) => p.id === state.me.id);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 text-amber-50 backdrop-blur-[2px]">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-amber-100/20 bg-[#160f0b]/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
        <h2 className="text-2xl font-bold tracking-tight">
          {youWon
            ? "Вы победили!"
            : winners.length > 1
              ? "Ничья!"
              : "Партия окончена"}
        </h2>
        <div className="space-y-2">
          {winners.map((w) => (
            <p
              key={w.id}
              className="rounded-lg border border-amber-100/12 bg-stone-950/30 px-3 py-2"
            >
              <span className="font-semibold text-amber-100">{w.name}</span>{" "}
              <span className="text-amber-50/60">
                — {w.chests.length} сундуков
              </span>
            </p>
          ))}
        </div>
        <h3 className="pt-1 text-sm font-semibold uppercase text-amber-50/55">
          Все результаты
        </h3>
        <ul className="space-y-1 text-sm">
          {[...state.players]
            .sort((a, b) => b.chests.length - a.chests.length)
            .map((p) => (
              <li
                key={p.id}
                className="flex justify-between gap-3 border-b border-amber-100/10 py-1.5 last:border-b-0"
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-amber-50/60">
                  {p.chests.length} сундуков
                </span>
              </li>
            ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-amber-300 px-4 py-3 font-medium text-stone-950 transition hover:bg-amber-200"
        >
          На главную
        </button>
      </div>
    </div>
  );
}
