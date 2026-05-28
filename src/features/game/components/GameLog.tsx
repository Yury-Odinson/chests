"use client";

import { useEffect, useRef } from "react";
import type { GameLogItem, GameLogKind } from "@/shared/types/game";

const KIND_CLASS: Record<GameLogKind, string> = {
  neutral: "text-zinc-700 dark:text-zinc-200",
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  error: "text-red-600 dark:text-red-400",
  muted: "text-zinc-500 dark:text-zinc-400",
};

function renderMessage(message: string): React.ReactNode {
  const parts = message.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function GameLog({ items }: { items: GameLogItem[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="border-b border-[var(--card-border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-60">
        Лог
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm">
        {items.length === 0 && (
          <p className="opacity-50">События появятся здесь.</p>
        )}
        {items.map((item) => (
          <p
            key={item.id}
            className={`leading-snug ${KIND_CLASS[item.kind] ?? KIND_CLASS.neutral}`}
          >
            {renderMessage(item.message)}
          </p>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
