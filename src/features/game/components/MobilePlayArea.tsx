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
import { MobileMenuBar } from "./MobileMenuBar";
import { MyHand } from "./MyHand";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Stacked, flow-based layout for phones (portrait and landscape), used below
 * the `md` breakpoint instead of the absolute-over-image table scene.
 *
 * Layout follows the agreed mockup, top → bottom:
 *   [log strip]                    full width, collapsible
 *   [opponents]                    wrapping row of opponent tiles
 *   [table / AskFlow controls]     ask flow, deck + chest counter beside it
 *   [mascot hint]                  small mascot + bubble
 *   [my hand]                      own seat + hand, sticky at the bottom
 *
 * Keeps the same `data-anchor` attributes (`seat-${id}`, `deck`) so the shared
 * CardFlightLayer animations work here too.
 */
export function MobilePlayArea({
  state,
  socket,
  onLeave,
}: {
  state: ClientGameState;
  socket: GameSocket;
  onLeave: () => void;
}) {
  const isHost = state.hostId === state.me.id;
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
      className="game-mobile absolute inset-0 flex flex-col overflow-y-auto bg-stone-950 bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(9, 6, 5, 0.42) 0%, rgba(9, 6, 5, 0.72) 100%), url('/game-bg.webp')",
      }}
    >
      <div className="shrink-0 px-3 pt-3">
        <MobileMenuBar
          isHost={isHost}
          canFinish={state.status === "playing"}
          onFinish={() => socket.emit("room:finish", { roomId: state.roomId })}
          onLeave={onLeave}
          log={state.log}
          stacked
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 pb-3 pt-3">
        {/* Opponents row (3 / 4 across the top, 2 on the left in the mockup). */}
        {opponents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {opponents.map((player) => {
              const isSelectable =
                isOwnAskStage && possibleTargets.some((p) => p.id === player.id);
              return (
                <MobileSeat
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
        )}

        {/* Table: chest counter + deck on a strip, controls below. */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/20 bg-zinc-950/55 px-3 py-2 text-sm text-amber-50 backdrop-blur-[2px]">
          <span>
            <span className="text-amber-100/60">сундуки:</span>{" "}
            <span className="font-semibold">{totalChests}/13</span>
          </span>
          <MobileDeck count={state.deckCount} />
        </div>

        <div className="pointer-events-auto">
          <AskFlow
            state={state}
            socket={socket}
            selectedTargetId={activeTargetId}
            onTargetSelect={setSelectedTargetId}
          />
        </div>

        <MobileMascotHint
          state={state}
          activeTargetId={activeTargetId}
          isOwnAskStage={isOwnAskStage}
          canChooseTarget={canChooseTarget}
        />
      </div>

      {/* My seat + hand, sticky at the bottom so it's always reachable. */}
      <MobileMySeat state={state} />
    </section>
  );
}

function MobileDeck({ count }: { count: number }) {
  const empty = count === 0;
  return (
    <div data-anchor="deck" className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-amber-50/55">
        колода
      </span>
      <div className="relative h-12 w-9">
        {empty ? (
          <div className="flex h-full w-full items-center justify-center rounded-[6px] border-2 border-dashed border-amber-100/25 bg-stone-950/35 text-[9px] uppercase text-amber-50/45">
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
            "absolute -bottom-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full border px-1 text-[11px] font-bold shadow",
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

function MobileSeat({
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
    "min-w-[140px] flex-1 rounded-xl border px-2.5 py-2 text-left text-amber-50 shadow-lg transition bg-[#1d130d]/90",
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
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={[
              "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold shadow-inner",
              player.connected
                ? "border-emerald-200/40 bg-emerald-900/65 text-emerald-50"
                : "border-zinc-300/20 bg-zinc-900/70 text-zinc-300",
            ].join(" ")}
            title={player.connected ? "онлайн" : "офлайн"}
          >
            {player.name.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold leading-tight">
              {player.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-amber-50/62">
              {player.isBot && <span className="text-amber-200">бот</span>}
              {player.isHost && <span>хост</span>}
              {!player.connected && <span>офлайн</span>}
            </div>
          </div>
        </div>
        {isCurrent && (
          <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-semibold text-stone-950">
            ход
          </span>
        )}
      </div>

      <MobileCardFan count={player.cardsCount} />

      <div className="mt-1.5 border-t border-amber-100/12 pt-1.5">
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

function MobileCardFan({ count }: { count: number }) {
  const visibleCards = Array.from({ length: Math.min(count, 5) });
  return (
    <div className="mt-1.5 flex h-7 items-end">
      {visibleCards.map((_, index) => (
        <img
          key={index}
          src="/card-back.webp"
          alt=""
          draggable={false}
          className="h-6 w-[18px] rounded-[3px] object-cover shadow-sm"
          style={{
            marginLeft: index === 0 ? 0 : -7,
            transform: `rotate(${(index - visibleCards.length / 2) * 4}deg)`,
          }}
        />
      ))}
      {count > 5 && (
        <span className="ml-2 self-center rounded-full border border-amber-100/14 bg-stone-950/32 px-1.5 py-0.5 text-[9px] text-amber-50/72">
          {count} карт
        </span>
      )}
    </div>
  );
}

function MobileMySeat({ state }: { state: ClientGameState }) {
  const isCurrent = state.currentPlayerId === state.me.id;

  return (
    <section
      data-anchor={`seat-${state.me.id}`}
      className={[
        "sticky bottom-0 z-10 mx-2 mb-2 rounded-2xl border bg-[#160f0b]/90 p-2 text-amber-50 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] backdrop-blur-[3px]",
        isCurrent
          ? "border-amber-300/85 ring-2 ring-amber-300/40"
          : "border-amber-100/18",
      ].join(" ")}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber-200/40 bg-amber-700/70 text-xs font-semibold text-amber-50 shadow-inner">
            {state.me.name.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
          <h3 className="truncate text-sm font-semibold leading-tight">
            {state.me.name}
          </h3>
          {isCurrent && (
            <span className="shrink-0 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-semibold text-stone-950">
              ваш ход
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[10px]">
          <span className="shrink-0 text-amber-50/62">сундуки:</span>
          <ChestsList chests={state.me.chests} />
        </div>
      </div>
      <div className="max-h-[34vh] overflow-y-auto overflow-x-auto rounded-xl border border-amber-100/12 bg-stone-950/26 p-2">
        <MyHand hand={state.me.hand} compact />
      </div>
    </section>
  );
}

const HINTS_STORAGE_KEY = "chests:hints-enabled";

function MobileMascotHint({
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
        className="self-start rounded-full border border-amber-200/30 bg-zinc-950/70 px-3 py-1.5 text-xs font-medium text-amber-50 shadow-lg backdrop-blur-[2px]"
      >
        💡 Включить подсказки
      </button>
    );
  }

  const message = mobilePhaseHint(
    state,
    isOwnAskStage,
    activeTargetId,
    canChooseTarget
  );

  return (
    <div className="flex items-end gap-2">
      <img
        src="/mascot.webp"
        alt="Маскот игры"
        className="h-16 w-auto shrink-0 select-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]"
        draggable={false}
      />
      <div className="relative flex-1 rounded-[18px] border-2 border-stone-900 bg-amber-50 px-3 py-2 text-xs font-semibold leading-snug text-stone-900 shadow-lg">
        {message}
        <button
          type="button"
          onClick={toggle}
          title="Скрыть подсказки"
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-50 text-[10px] leading-none text-stone-700"
        >
          ✕
        </button>
        <span className="absolute -bottom-2 left-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-stone-900 bg-amber-50" />
      </div>
    </div>
  );
}

/** Same phase logic as the desktop mascot hint, trimmed for the mobile bubble. */
function mobilePhaseHint(
  state: ClientGameState,
  isOwnAskStage: boolean,
  activeTargetId: string | null,
  canChooseTarget: boolean
): string {
  const pending = state.pendingGuess;

  if (pending && pending.askerId === state.me.id) {
    if (pending.stage === "awaiting-detail") {
      return `У соперника есть «${pending.rank}». Назови, сколько таких карт у него на руках.`;
    }
    return `Количество верное! Теперь назови масти всех «${pending.rank}» — их ${pending.count}.`;
  }

  if (state.currentPlayerId !== state.me.id || pending) {
    return "Ход соперника. Следи за столом.";
  }

  if (isOwnAskStage) {
    if (!canChooseTarget) {
      return "Сейчас спросить не у кого — ждём, пока у соперников появятся карты.";
    }
    if (!activeTargetId) {
      return "Твой ход! Выбери соперника, у которого спросишь карты.";
    }
    return "Теперь выбери ранг — спрашивать можно только то, что есть у тебя на руке.";
  }

  return "Следи за столом. Я подскажу, если что.";
}
