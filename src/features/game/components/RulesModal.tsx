"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Reusable "Правила игры" overlay + a button that opens it. One source of
 * truth for the rules text, reused on the home screen, in the lobby, and in
 * the in-game menus (desktop Header + mobile menu bar).
 *
 * The rules text mirrors the authoritative rules in AGENTS.md, phrased for a
 * player rather than for the engine.
 */
export function RulesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Правила игры"
    >
      <button
        type="button"
        aria-label="Закрыть правила"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
      />

      <section className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col rounded-2xl border border-amber-100/20 bg-[#160f0b] text-amber-50 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-100/15 px-5 py-4">
          <h2 className="text-lg font-bold tracking-tight">Правила игры</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-amber-100/20 text-amber-50/80 transition hover:border-amber-200/70 hover:text-amber-50"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-amber-50/85">
          <RuleSection title="Цель">
            <p>
              Собирать «сундуки» — все 4 карты одного ранга. Игра идёт колодой
              из 52 карт, играют 2–5 человек. Побеждает тот, кто соберёт больше
              всех сундуков. Всего сундуков 13.
            </p>
          </RuleSection>

          <RuleSection title="Начало">
            <ul className="list-disc space-y-1 pl-5">
              <li>2–3 игрока — по 7 карт на руки.</li>
              <li>4–5 игроков — по 5 карт на руки.</li>
              <li>Оставшиеся карты лежат в колоде.</li>
            </ul>
          </RuleSection>

          <RuleSection title="Ход">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Выберите соперника.</li>
              <li>
                Выберите ранг — спрашивать можно только то, что есть у вас на
                руке.
              </li>
              <li>
                Если у соперника <b>нет</b> такого ранга — вы берёте 1 карту из
                колоды, ход переходит дальше.
              </li>
              <li>
                Если <b>есть</b> — назовите, <b>сколько</b> таких карт у него
                (1–3):
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>
                    Не угадали количество — берёте карту, ход переходит дальше
                    (точное число не раскрывается).
                  </li>
                  <li>
                    Угадали — назовите <b>все масти</b> этих карт. Все масти
                    верны — забираете карты себе и <b>ходите ещё раз</b>. Хоть
                    одна масть неверна — неверно названные масти открываются,
                    берёте карту, ход переходит дальше.
                  </li>
                </ul>
              </li>
            </ol>
            <p className="mt-2 text-amber-50/65">
              Короткого пути нет: даже ради одной карты сначала угадайте точное
              количество, затем масти.
            </p>
          </RuleSection>

          <RuleSection title="Сундуки">
            <p>
              Как только все 4 карты одного ранга оказались у вас на руке, они
              автоматически уходят в сундук — это записывается в журнал.
            </p>
          </RuleSection>

          <RuleSection title="Конец игры">
            <p>
              Игра заканчивается, когда собраны все 13 сундуков (или хост
              завершает партию вручную). Побеждает тот, у кого больше сундуков;
              при равенстве побеждают все, кто набрал поровну.
            </p>
          </RuleSection>
        </div>

        <footer className="shrink-0 border-t border-amber-100/15 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-amber-300 px-4 py-2.5 font-medium text-stone-950 transition hover:bg-amber-200"
          >
            Понятно
          </button>
        </footer>
      </section>
    </div>
  );
}

function RuleSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold text-amber-100">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Self-contained trigger: a button that owns the modal's open state. Drop it
 * anywhere a "Правила" entry point is needed. `variant` tunes the look to its
 * surroundings; `label` lets callers shorten it to an icon on tight bars.
 */
export function RulesButton({
  variant = "link",
  label = "Правила",
}: {
  variant?: "link" | "outline" | "icon";
  /** Text for link/outline variants. The icon variant ignores it. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  // The icon variant is a compact yellow "?" badge for tight bars (mobile).
  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Правила"
          title="Правила"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-300 text-xs font-bold text-stone-950 shadow transition hover:bg-amber-200"
        >
          ?
        </button>
        <RulesModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  const className =
    variant === "outline"
      ? "rounded-md border border-amber-100/20 px-2.5 py-1 text-xs text-amber-50/82 transition hover:border-amber-200/70 hover:text-amber-50"
      : "text-sm text-amber-100/80 underline-offset-2 transition hover:text-amber-100 hover:underline";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <RulesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
