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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-[var(--card-bg)] p-6 shadow-xl">
        <h2 className="text-2xl font-bold">
          {youWon
            ? "🎉 Вы победили!"
            : winners.length > 1
              ? "Ничья!"
              : "Партия окончена"}
        </h2>
        <div className="space-y-1">
          {winners.map((w) => (
            <p key={w.id}>
              <span className="font-medium">{w.name}</span>{" "}
              <span className="opacity-60">— {w.chests.length} сундуков</span>
            </p>
          ))}
        </div>
        <h3 className="pt-2 text-sm font-semibold uppercase opacity-60">
          Все результаты
        </h3>
        <ul className="space-y-1 text-sm">
          {[...state.players]
            .sort((a, b) => b.chests.length - a.chests.length)
            .map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span>{p.chests.length} сундуков</span>
              </li>
            ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-white"
        >
          На главную
        </button>
      </div>
    </div>
  );
}
