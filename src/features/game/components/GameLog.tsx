"use client";

import { useLayoutEffect, useRef } from "react";
import type { GameLogItem, GameLogKind } from "@/shared/types/game";

const KIND_CLASS: Record<GameLogKind, string> = {
  neutral: "text-zinc-700 dark:text-zinc-200",
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  error: "text-red-600 dark:text-red-400",
  muted: "text-zinc-500 dark:text-zinc-400",
};

const TABLE_KIND_CLASS: Record<GameLogKind, string> = {
  neutral: "text-amber-50/86",
  info: "text-sky-200",
  success: "text-emerald-200",
  error: "text-red-200",
  muted: "text-amber-50/48",
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

export function GameLog({
  items,
  variant = "default",
}: {
  items: GameLogItem[];
  variant?: "default" | "table";
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const kindClass = variant === "table" ? TABLE_KIND_CLASS : KIND_CLASS;
  const lastItemId = items[items.length - 1]?.id;

  useLayoutEffect(() => {
    const scrollToBottom = () => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    };

    scrollToBottom();
    const frame = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(frame);
  }, [lastItemId]);

  return (
    <div
      className={[
        "flex h-full flex-col overflow-hidden border",
        variant === "table"
          ? "border-y-0 border-r-0 border-amber-100/20 bg-[#160f0b]/86 text-amber-50 shadow-[0_18px_56px_rgba(0,0,0,0.44)] backdrop-blur-[3px]"
          : "rounded-xl border-[var(--card-border)] bg-[var(--card-bg)]",
      ].join(" ")}
    >
      <div
        className={[
          "border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-60",
          variant === "table"
            ? "border-amber-100/16"
            : "border-[var(--card-border)]",
        ].join(" ")}
      >
        Лог
      </div>
      <div
        ref={scrollRef}
        className="flex-1 space-y-1 overflow-y-auto px-3 pb-10 pt-2 text-sm"
      >
        {items.length === 0 && (
          <p className="opacity-50">События появятся здесь.</p>
        )}
        {items.map((item) => (
          <p
            key={item.id}
            className={`leading-snug ${kindClass[item.kind] ?? kindClass.neutral}`}
          >
            {renderMessage(item.message)}
          </p>
        ))}
      </div>
    </div>
  );
}
