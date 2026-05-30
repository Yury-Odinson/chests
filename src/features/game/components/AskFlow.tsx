"use client";

import { useState } from "react";
import { type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/shared/types/events";
import type { ClientGameState, Rank, Suit } from "@/shared/types/game";
import { RANKS, SUITS } from "@/shared/types/game";
import { suitLabel, suitSymbol } from "./PlayingCard";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface AskFlowProps {
  state: ClientGameState;
  socket: GameSocket;
  selectedTargetId?: string | null;
  onTargetSelect?: (playerId: string | null) => void;
}

const TABLE_PANEL_CLASS =
  "rounded-2xl border border-amber-100/20 bg-[#160f0b]/88 p-4 text-amber-50 shadow-[0_18px_56px_rgba(0,0,0,0.48)] backdrop-blur-[3px]";

const SECONDARY_TEXT_CLASS = "text-amber-50/65";

export function AskFlow({
  state,
  socket,
  selectedTargetId,
  onTargetSelect,
}: AskFlowProps) {
  const me = state.me;
  const isMyTurn = state.currentPlayerId === me.id;
  const pending = state.pendingGuess;

  const currentName = state.players.find((p) => p.id === state.currentPlayerId)
    ?.name;

  if (pending) {
    const askerName =
      state.players.find((p) => p.id === pending.askerId)?.name ?? "игрок";
    const targetName =
      state.players.find((p) => p.id === pending.targetId)?.name ?? "игрок";

    if (pending.askerId === me.id) {
      if (pending.stage === "awaiting-detail") {
        return (
          <DetailStage
            state={state}
            socket={socket}
            targetName={targetName}
            rank={pending.rank}
          />
        );
      }
      return (
        <SuitsStage
          state={state}
          socket={socket}
          targetName={targetName}
          rank={pending.rank}
          count={pending.count}
        />
      );
    }

    return (
      <div className={TABLE_PANEL_CLASS}>
        <p className="font-medium">
          {askerName} уточняет {pending.rank} у {targetName}…
        </p>
        <p className={SECONDARY_TEXT_CLASS}>Ждём ответа.</p>
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className={TABLE_PANEL_CLASS}>
        Ходит <span className="font-medium">{currentName ?? "…"}</span>
      </div>
    );
  }

  return (
    <AskStage
      state={state}
      socket={socket}
      selectedTargetId={selectedTargetId}
      onTargetSelect={onTargetSelect}
    />
  );
}

function AskStage({
  state,
  socket,
  selectedTargetId,
  onTargetSelect,
}: {
  state: ClientGameState;
  socket: GameSocket;
  selectedTargetId?: string | null;
  onTargetSelect?: (playerId: string | null) => void;
}) {
  const me = state.me;
  const [internalTargetId, setInternalTargetId] = useState<string | null>(null);

  const possibleTargets = state.players.filter(
    (p) => p.id !== me.id && p.cardsCount > 0
  );
  const rawTargetId =
    selectedTargetId === undefined ? internalTargetId : selectedTargetId;
  const target = possibleTargets.find((p) => p.id === rawTargetId) ?? null;
  const targetId = target?.id ?? null;

  const myRanks = uniqueRanksInHand(me.hand.map((c) => c.rank));

  const setTargetId = (playerId: string | null) => {
    if (onTargetSelect) {
      onTargetSelect(playerId);
      return;
    }
    setInternalTargetId(playerId);
  };

  const ask = (rank: Rank) => {
    if (!targetId) return;
    socket.emit("game:ask-rank", {
      roomId: state.roomId,
      targetPlayerId: targetId,
      rank,
    });
    setTargetId(null);
  };

  if (possibleTargets.length === 0) {
    return (
      <div className={TABLE_PANEL_CLASS}>
        У соперников нет карт. Ждём окончания партии.
      </div>
    );
  }

  return (
    <div className={`${TABLE_PANEL_CLASS} space-y-3`}>
      {!target && (
        <div className="text-center">
          <p className="text-lg font-semibold">Выберите соперника</p>
          <p className={`mt-1 text-sm ${SECONDARY_TEXT_CLASS}`}>
            Нажмите на подсвеченное место за столом.
          </p>
        </div>
      )}

      {target && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-50/45">
                соперник
              </p>
              <p className="text-base font-semibold">{target.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setTargetId(null)}
              className="rounded-lg border border-amber-100/20 px-2.5 py-1 text-xs text-amber-50/75 transition hover:border-amber-200/60 hover:text-amber-50"
            >
              сменить
            </button>
          </div>
          <p className="text-sm font-semibold">Какой ранг спросить?</p>
          <p className={`text-xs ${SECONDARY_TEXT_CLASS}`}>
            Можно спрашивать только ранг из вашей руки.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {myRanks.map((rank) => (
              <button
                key={rank}
                type="button"
                onClick={() => ask(rank)}
                className="min-w-11 rounded-lg border border-amber-100/25 bg-amber-50 px-3 py-2 text-sm font-semibold text-stone-950 transition hover:border-amber-200 hover:bg-white"
              >
                {rank}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailStage({
  state,
  socket,
  targetName,
  rank,
}: {
  state: ClientGameState;
  socket: GameSocket;
  targetName: string;
  rank: Rank;
}) {
  const me = state.me;
  const askerCount = me.hand.filter((c) => c.rank === rank).length;
  const maxPossible = 4 - askerCount;

  const sendCount = (count: number) => {
    socket.emit("game:guess-count", { roomId: state.roomId, count });
  };

  return (
    <div className={`${TABLE_PANEL_CLASS} space-y-3`}>
      <p className="text-sm">
        У <span className="font-medium">{targetName}</span> есть карты ранга{" "}
        <span className="font-bold">{rank}</span>. Сколько именно?
      </p>

      <div className="space-y-2">
        <p className={`text-sm ${SECONDARY_TEXT_CLASS}`}>
          Угадайте количество карт ранга {rank} (от 1 до {maxPossible}). Угадаете
          — назовёте масти и заберёте их.
        </p>
        <div className="flex gap-2">
          {Array.from({ length: maxPossible }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => sendCount(n)}
              className="flex-1 rounded-lg border border-amber-100/20 bg-amber-50 p-3 text-xl font-semibold text-stone-950 transition hover:border-amber-200 hover:bg-white"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuitsStage({
  state,
  socket,
  targetName,
  rank,
  count,
}: {
  state: ClientGameState;
  socket: GameSocket;
  targetName: string;
  rank: Rank;
  count: number;
}) {
  const me = state.me;
  const mySuitsOfRank = new Set(
    me.hand.filter((c) => c.rank === rank).map((c) => c.suit)
  );
  const availableSuits = SUITS.filter((s) => !mySuitsOfRank.has(s));
  const [picked, setPicked] = useState<Suit[]>([]);

  const toggle = (suit: Suit) => {
    setPicked((prev) =>
      prev.includes(suit)
        ? prev.filter((s) => s !== suit)
        : prev.length < count
          ? [...prev, suit]
          : prev
    );
  };

  const submit = () => {
    if (picked.length !== count) return;
    socket.emit("game:guess-suits", { roomId: state.roomId, suits: picked });
  };

  return (
    <div className={`${TABLE_PANEL_CLASS} space-y-3`}>
      <p className="text-sm">
        Угадано: у <span className="font-medium">{targetName}</span> {count}{" "}
        карт ранга <span className="font-bold">{rank}</span>. Назовите{" "}
        <span className="font-semibold">все {count}</span> мастей.
      </p>
      <div className="flex gap-2">
        {availableSuits.map((suit) => {
          const isPicked = picked.includes(suit);
          return (
            <button
              key={suit}
              type="button"
              onClick={() => toggle(suit)}
              className={[
                "flex flex-1 flex-col items-center gap-1 rounded-lg border p-3",
                isPicked
                  ? "border-amber-300 ring-2 ring-amber-300/40"
                  : "border-amber-100/20",
                "bg-amber-50 transition hover:border-amber-200 hover:bg-white",
                tableSuitColorClass(suit),
              ].join(" ")}
            >
              <span className="text-2xl">{suitSymbol(suit)}</span>
              <span className="text-xs">{suitLabel(suit)}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={picked.length !== count}
        className="w-full rounded-lg bg-amber-300 px-4 py-2 font-medium text-stone-950 transition hover:bg-amber-200 disabled:opacity-50"
      >
        Назвать ({picked.length}/{count})
      </button>
    </div>
  );
}

function uniqueRanksInHand(ranks: Rank[]): Rank[] {
  const set = new Set(ranks);
  return RANKS.filter((r) => set.has(r));
}

function tableSuitColorClass(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds"
    ? "text-red-700"
    : "text-stone-950";
}
