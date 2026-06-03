"use client";

import { useState } from "react";
import { type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/shared/types/events";
import type { ClientGameState, PublicPlayer } from "@/shared/types/game";
import { AskFlow } from "./AskFlow";
import { ChestsList } from "./ChestsList";
import { GameLog } from "./GameLog";
import { MyHand } from "./MyHand";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Layout for phones held sideways (short viewport, wide). Used by the
 * `mobile-landscape` branch of useLayoutMode.
 *
 * This is a working scaffold: the grid below is intentionally simple so it can
 * be re-styled freely. What must stay intact for the game to keep working:
 *  - the `data-anchor` attributes (`seat-${id}`, `deck`) — the shared
 *    CardFlightLayer animates between them;
 *  - the target-selection wiring (selectedTargetId → AskFlow / seat buttons);
 *  - rendering AskFlow, MyHand, the log and the mascot hint somewhere.
 */
export function MobileLandscapePlayArea({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const opponents = state.players.filter((p) => p.id !== state.me.id);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const possibleTargets = opponents.filter((p) => p.cardsCount > 0);
  const isOwnAskStage =
    state.currentPlayerId === state.me.id && !state.pendingGuess;
  const validSelectedTargetId = possibleTargets.some(
    (p) => p.id === selectedTargetId
  )
    ? selectedTargetId
    : null;
  const activeTargetId = isOwnAskStage ? validSelectedTargetId : null;
  const isChoosingTarget =
    isOwnAskStage && possibleTargets.length > 0 && !activeTargetId;
  const canChooseTarget = possibleTargets.length > 0;

  const totalChests = state.players.reduce((s, p) => s + p.chests.length, 0);

  return (
    <section
      className="game-mobile-landscape absolute inset-0 flex flex-col overflow-hidden bg-stone-950 bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(9, 6, 5, 0.42) 0%, rgba(9, 6, 5, 0.72) 100%), url('/game-bg.webp')",
      }}
    >
      {/* Spacer for the absolutely-positioned Header above. */}
      <div className="h-[52px] shrink-0" />

      {/* ── Replace the grid below with your own landscape layout ──────────
          Three columns here as a starting point:
            left  : opponents (vertical list)
            center: log + table controls (AskFlow) + mascot hint
            right : deck + my hand                                          */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] gap-2 px-2 pb-2">
        {/* Left: opponents */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {opponents.map((player) => {
            const isSelectable =
              isOwnAskStage && possibleTargets.some((p) => p.id === player.id);
            return (
              <LandscapeSeat
                key={player.id}
                player={player}
                isCurrent={state.currentPlayerId === player.id}
                isSelectable={isSelectable}
                isSelected={activeTargetId === player.id}
                isDimmed={isChoosingTarget && !isSelectable}
                onSelect={() => setSelectedTargetId(player.id)}
              />
            );
          })}
        </div>

        {/* Center: log + table controls + mascot */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <LandscapeLog items={state.log} />

          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200/20 bg-zinc-950/55 px-2.5 py-1.5 text-xs text-amber-50">
            <span>
              <span className="text-amber-100/60">сундуки:</span>{" "}
              <span className="font-semibold">{totalChests}/13</span>
            </span>
          </div>

          <div className="pointer-events-auto">
            <AskFlow
              state={state}
              socket={socket}
              selectedTargetId={activeTargetId}
              onTargetSelect={setSelectedTargetId}
            />
          </div>

          <LandscapeMascotHint
            state={state}
            activeTargetId={activeTargetId}
            isOwnAskStage={isOwnAskStage}
            canChooseTarget={canChooseTarget}
          />
        </div>

        {/* Right: deck + my hand */}
        <div className="flex min-h-0 flex-col gap-2">
          <LandscapeDeck count={state.deckCount} />
          <LandscapeMySeat state={state} />
        </div>
      </div>
    </section>
  );
}

function LandscapeLog({ items }: { items: ClientGameState["log"] }) {
  const [open, setOpen] = useState(false);
  const last = items[items.length - 1];

  return (
    <div className="overflow-hidden rounded-lg border border-amber-100/20 bg-[#160f0b]/86 text-amber-50 shadow-lg backdrop-blur-[3px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-50/55">
          лог
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-amber-50/86">
          {last ? stripMarkdown(last.message) : "События появятся здесь."}
        </span>
        <span className="shrink-0 text-amber-50/55">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="h-32 border-t border-amber-100/16">
          <GameLog items={items} variant="table" />
        </div>
      )}
    </div>
  );
}

function stripMarkdown(message: string): string {
  return message.replace(/\*\*([^*]+)\*\*/g, "$1");
}

function LandscapeDeck({ count }: { count: number }) {
  const empty = count === 0;
  return (
    <div
      data-anchor="deck"
      className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-100/16 bg-[#160f0b]/80 px-2.5 py-1.5"
    >
      <span className="text-[9px] uppercase tracking-wide text-amber-50/55">
        колода
      </span>
      <div className="relative h-11 w-8">
        {empty ? (
          <div className="flex h-full w-full items-center justify-center rounded-[6px] border-2 border-dashed border-amber-100/25 bg-stone-950/35 text-[8px] uppercase text-amber-50/45">
            пусто
          </div>
        ) : (
          <img
            src="/card-back.webp"
            alt="Колода"
            className="h-full w-full rounded-[6px] object-cover shadow-md"
            draggable={false}
          />
        )}
        <span
          className={[
            "absolute -bottom-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full border px-1 text-[10px] font-bold shadow",
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

function LandscapeSeat({
  player,
  isCurrent,
  isSelectable,
  isSelected,
  isDimmed,
  onSelect,
}: {
  player: PublicPlayer;
  isCurrent: boolean;
  isSelectable: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}) {
  const className = [
    "shrink-0 rounded-lg border px-2 py-1.5 text-left text-amber-50 shadow transition bg-[#1d130d]/90",
    isDimmed ? "opacity-45" : "opacity-100",
    isSelected
      ? "border-amber-200 ring-2 ring-amber-200/70"
      : isCurrent
        ? "border-amber-300/80 ring-2 ring-amber-300/45"
        : isSelectable
          ? "border-amber-200/60 ring-2 ring-amber-200/30"
          : "border-amber-100/18",
  ].join(" ");

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={[
              "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold shadow-inner",
              player.connected
                ? "border-emerald-200/40 bg-emerald-900/65 text-emerald-50"
                : "border-zinc-300/20 bg-zinc-900/70 text-zinc-300",
            ].join(" ")}
            title={player.connected ? "онлайн" : "офлайн"}
          >
            {player.name.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
          <span className="truncate text-[11px] font-semibold leading-tight">
            {player.name}
          </span>
        </div>
        {isCurrent && (
          <span className="shrink-0 rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-semibold text-stone-950">
            ход
          </span>
        )}
      </div>

      <LandscapeCardFan count={player.cardsCount} />

      <div className="mt-1 border-t border-amber-100/12 pt-1">
        <ChestsList chests={player.chests} />
      </div>
    </>
  );

  if (isSelectable) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`${className} cursor-pointer`}
        data-anchor={`seat-${player.id}`}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={className} data-anchor={`seat-${player.id}`}>
      {content}
    </article>
  );
}

function LandscapeCardFan({ count }: { count: number }) {
  const visibleCards = Array.from({ length: Math.min(count, 5) });
  return (
    <div className="mt-1 flex h-6 items-end">
      {visibleCards.map((_, index) => (
        <img
          key={index}
          src="/card-back.webp"
          alt=""
          draggable={false}
          className="h-5 w-[15px] rounded-[3px] object-cover shadow-sm"
          style={{
            marginLeft: index === 0 ? 0 : -6,
            transform: `rotate(${(index - visibleCards.length / 2) * 4}deg)`,
          }}
        />
      ))}
      {count > 5 && (
        <span className="ml-1.5 self-center rounded-full border border-amber-100/14 bg-stone-950/32 px-1 py-0.5 text-[8px] text-amber-50/72">
          {count}
        </span>
      )}
    </div>
  );
}

function LandscapeMySeat({ state }: { state: ClientGameState }) {
  const isCurrent = state.currentPlayerId === state.me.id;

  return (
    <section
      data-anchor={`seat-${state.me.id}`}
      className={[
        "flex min-h-0 flex-1 flex-col rounded-xl border bg-[#160f0b]/90 p-1.5 text-amber-50 shadow-lg backdrop-blur-[3px]",
        isCurrent
          ? "border-amber-300/85 ring-2 ring-amber-300/40"
          : "border-amber-100/18",
      ].join(" ")}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-amber-200/40 bg-amber-700/70 text-[10px] font-semibold text-amber-50 shadow-inner">
            {state.me.name.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
          <span className="truncate text-[11px] font-semibold leading-tight">
            {state.me.name}
          </span>
          {isCurrent && (
            <span className="shrink-0 rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-semibold text-stone-950">
              ваш ход
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1 text-[9px]">
          <span className="shrink-0 text-amber-50/62">сундуки:</span>
          <ChestsList chests={state.me.chests} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-amber-100/12 bg-stone-950/26 p-1.5">
        <MyHand hand={state.me.hand} compact />
      </div>
    </section>
  );
}

const HINTS_STORAGE_KEY = "chests:hints-enabled";

function LandscapeMascotHint({
  state,
  activeTargetId,
  isOwnAskStage,
  canChooseTarget,
}: {
  state: ClientGameState;
  activeTargetId: string | null;
  isOwnAskStage: boolean;
  canChooseTarget: boolean;
}) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(HINTS_STORAGE_KEY) !== "off";
  });

  const toggle = () => {
    setEnabled((on) => {
      const next = !on;
      localStorage.setItem(HINTS_STORAGE_KEY, next ? "on" : "off");
      return next;
    });
  };

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="self-start rounded-full border border-amber-200/30 bg-zinc-950/70 px-2.5 py-1 text-[11px] font-medium text-amber-50 shadow-lg"
      >
        💡 Подсказки
      </button>
    );
  }

  const message = landscapePhaseHint(
    state,
    isOwnAskStage,
    activeTargetId,
    canChooseTarget
  );

  return (
    <div className="flex items-end gap-1.5">
      <img
        src="/mascot.webp"
        alt="Маскот игры"
        className="h-12 w-auto shrink-0 select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
        draggable={false}
      />
      <div className="relative flex-1 rounded-[14px] border-2 border-stone-900 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-stone-900 shadow-lg">
        {message}
        <button
          type="button"
          onClick={toggle}
          title="Скрыть подсказки"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-50 text-[9px] leading-none text-stone-700"
        >
          ✕
        </button>
        <span className="absolute -bottom-2 left-3 h-3.5 w-3.5 rotate-45 border-b-2 border-l-2 border-stone-900 bg-amber-50" />
      </div>
    </div>
  );
}

/** Same phase logic as the other mascot hints, trimmed for the small bubble. */
function landscapePhaseHint(
  state: ClientGameState,
  isOwnAskStage: boolean,
  activeTargetId: string | null,
  canChooseTarget: boolean
): string {
  const pending = state.pendingGuess;

  if (pending && pending.askerId === state.me.id) {
    if (pending.stage === "awaiting-detail") {
      return `Есть «${pending.rank}». Назови, сколько таких карт.`;
    }
    return `Верно! Назови масти всех «${pending.rank}» — их ${pending.count}.`;
  }

  if (state.currentPlayerId !== state.me.id || pending) {
    return "Ход соперника. Следи за столом.";
  }

  if (isOwnAskStage) {
    if (!canChooseTarget) {
      return "Спросить пока не у кого — ждём карты у соперников.";
    }
    if (!activeTargetId) {
      return "Твой ход! Выбери соперника.";
    }
    return "Выбери ранг — только то, что есть у тебя на руке.";
  }

  return "Следи за столом.";
}
