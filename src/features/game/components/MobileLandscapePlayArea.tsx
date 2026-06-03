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
 * Layout for phones held sideways (short viewport, wide). Used by the
 * `mobile-landscape` branch of useLayoutMode.
 *
 * Grid (6 cols × 4 rows), per the agreed mockup:
 *
 *   m m m  l l l    row 1: header sits above (absolute); log fills the right
 *   3 a a  a a 4    row 2: opp slot 3 | table (AskFlow) | opp slot 4
 *   2 a a  a a 5    row 3: opp slot 2 | table (spans)   | opp slot 5
 *   t 1 1  1 1 k    row 4: mascot | my hand | deck
 *
 * Opponents fill fixed slots (1st→3, 2nd→4, 3rd→2, 4th→5); empty slots collapse
 * to nothing so the table stays centered with fewer players.
 *
 * Must stay intact for the game to keep working:
 *  - `data-anchor` attrs (`seat-${id}`, `deck`) drive CardFlightLayer;
 *  - target-selection wiring (selectedTargetId → AskFlow / seat buttons).
 */

// Visual slot order around the table → opponent index that fills it.
// Slots: top-left, top-right, bottom-left, bottom-right.
const SLOT_GRID_CLASS = [
  "col-start-1 row-start-1", // slot "3"
  "col-start-6 row-start-1", // slot "4"
  "col-start-1 row-start-2", // slot "2"
  "col-start-6 row-start-2", // slot "5"
];

export function MobileLandscapePlayArea({
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
      className="game-mobile-landscape absolute inset-0 flex flex-col overflow-hidden bg-stone-950 bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(9, 6, 5, 0.42) 0%, rgba(9, 6, 5, 0.72) 100%), url('/game-bg.webp')",
      }}
    >
      {/* Top bar ("m m m l l l"): actions + running log, full width. */}
      <div className="shrink-0 px-2 pt-2">
        <MobileMenuBar
          isHost={isHost}
          canFinish={state.status === "playing"}
          onFinish={() => socket.emit("room:finish", { roomId: state.roomId })}
          onLeave={onLeave}
          log={state.log}
        />
      </div>

      <div
        className="grid min-h-0 flex-1 gap-1.5 px-2 pb-2 pt-1.5"
        style={{
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          // rows 1–2: table + side seats; row 3: mascot | hand | deck.
          gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr) auto",
        }}
      >
        {/* Side opponent slots. */}
        {opponents.slice(0, SLOT_GRID_CLASS.length).map((player, index) => {
          const isSelectable =
            isOwnAskStage && possibleTargets.some((p) => p.id === player.id);
          return (
            <div
              key={player.id}
              className={`${SLOT_GRID_CLASS[index]} flex min-h-0 items-center`}
            >
              <LandscapeSeat
                player={player}
                isCurrent={state.currentPlayerId === player.id}
                isSelectable={isSelectable}
                isSelected={activeTargetId === player.id}
                isDimmed={isChoosingTarget && !isSelectable}
                onSelect={() => setSelectedTargetId(player.id)}
              />
            </div>
          );
        })}

        {/* Center table: AskFlow + chest counter, spanning the 4 middle cols
            across both upper rows. */}
        <div className="col-start-2 col-end-6 row-start-1 row-end-3 flex min-h-0 flex-col gap-1.5 overflow-y-auto">
          <div className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-200/20 bg-zinc-950/55 px-2.5 py-1 text-xs text-amber-50">
            <span className="text-amber-100/60">сундуки:</span>
            <span className="font-semibold">{totalChests}/13</span>
          </div>
          <div className="pointer-events-auto flex min-h-0 flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <AskFlow
                state={state}
                socket={socket}
                selectedTargetId={activeTargetId}
                onTargetSelect={setSelectedTargetId}
              />
            </div>
          </div>
        </div>

        {/* Bottom row: mascot (t) | my hand (1) | deck (k). */}
        <div className="col-start-1 row-start-3 flex items-end">
          <LandscapeMascotHint
            state={state}
            activeTargetId={activeTargetId}
            isOwnAskStage={isOwnAskStage}
            canChooseTarget={canChooseTarget}
          />
        </div>
        <div className="col-start-2 col-end-6 row-start-3 min-h-0">
          <LandscapeMySeat state={state} />
        </div>
        <div className="col-start-6 row-start-3 flex items-end justify-end">
          <LandscapeDeck count={state.deckCount} />
        </div>
      </div>
    </section>
  );
}

function LandscapeDeck({ count }: { count: number }) {
  const empty = count === 0;
  return (
    <div
      data-anchor="deck"
      className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-amber-100/16 bg-[#160f0b]/80 px-2 py-1.5"
    >
      <div className="relative h-11 w-8">
        {empty ? (
          <div className="flex h-full w-full items-center justify-center rounded-md border-2 border-dashed border-amber-100/25 bg-stone-950/35 text-[8px] uppercase text-amber-50/45">
            пусто
          </div>
        ) : (
          <img
            src="/card-back.webp"
            alt="Колода"
            className="h-full w-full rounded-md object-cover shadow-md"
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
      <span className="text-[8px] uppercase tracking-wide text-amber-50/55">
        колода
      </span>
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
    "w-full rounded-lg border px-2 py-1.5 text-left text-amber-50 shadow transition bg-[#1d130d]/90",
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
      <div className="flex items-center justify-between gap-1.5">
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
        "flex h-full min-h-0 flex-col rounded-xl border bg-[#160f0b]/90 p-1.5 text-amber-50 shadow-lg backdrop-blur-[3px]",
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
        className="rounded-full border border-amber-200/30 bg-zinc-950/70 px-2 py-1 text-[10px] font-medium text-amber-50 shadow-lg"
      >
        💡
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
    <div className="relative flex flex-col items-center">
      <div className="relative mb-1 w-full rounded-[12px] border-2 border-stone-900 bg-amber-50 px-2 py-1 text-[10px] font-semibold leading-snug text-stone-900 shadow-lg">
        {message}
        <button
          type="button"
          onClick={toggle}
          title="Скрыть подсказки"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-50 text-[9px] leading-none text-stone-700"
        >
          ✕
        </button>
        <span className="absolute -bottom-2 left-3 h-3.5 w-3.5 rotate-45 border-b-2 border-r-2 border-stone-900 bg-amber-50" />
      </div>
      <img
        src="/mascot.webp"
        alt="Маскот игры"
        className="h-12 w-auto select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
        draggable={false}
      />
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
      return `Есть «${pending.rank}». Сколько таких карт?`;
    }
    return `Верно! Назови масти «${pending.rank}» — их ${pending.count}.`;
  }

  if (state.currentPlayerId !== state.me.id || pending) {
    return "Ход соперника.";
  }

  if (isOwnAskStage) {
    if (!canChooseTarget) {
      return "Спросить пока не у кого.";
    }
    if (!activeTargetId) {
      return "Твой ход! Выбери соперника.";
    }
    return "Выбери ранг из своей руки.";
  }

  return "Следи за столом.";
}
