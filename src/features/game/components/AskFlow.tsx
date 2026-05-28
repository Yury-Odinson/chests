"use client";

import { useEffect, useState } from "react";
import { type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/shared/types/events";
import type {
  ClientGameState,
  PublicPlayer,
  Rank,
  Suit,
} from "@/shared/types/game";
import { RANKS, SUITS } from "@/shared/types/game";
import { suitColorClass, suitLabel, suitSymbol } from "./PlayingCard";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface AskFlowProps {
  state: ClientGameState;
  socket: GameSocket;
}

export function AskFlow({ state, socket }: AskFlowProps) {
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
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm">
        <p className="font-medium">
          {askerName} уточняет {pending.rank} у {targetName}…
        </p>
        <p className="opacity-60">Ждём ответа.</p>
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm">
        Ходит <span className="font-medium">{currentName ?? "…"}</span>
      </div>
    );
  }

  return <AskStage state={state} socket={socket} />;
}

function AskStage({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const me = state.me;
  const [targetId, setTargetId] = useState<string | null>(null);

  const possibleTargets = state.players.filter(
    (p) => p.id !== me.id && p.cardsCount > 0
  );

  const myRanks = uniqueRanksInHand(me.hand.map((c) => c.rank));

  useEffect(() => {
    if (targetId && !possibleTargets.some((p) => p.id === targetId)) {
      setTargetId(null);
    }
  }, [targetId, possibleTargets]);

  const ask = (rank: Rank) => {
    if (!targetId) return;
    socket.emit("game:ask-rank", {
      roomId: state.roomId,
      targetPlayerId: targetId,
      rank,
    });
  };

  if (possibleTargets.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm">
        У соперников нет карт. Ждём окончания партии.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <div>
        <p className="text-sm font-semibold">Ваш ход. Выберите соперника:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {possibleTargets.map((p) => (
            <TargetButton
              key={p.id}
              player={p}
              selected={targetId === p.id}
              onClick={() => setTargetId(p.id)}
            />
          ))}
        </div>
      </div>

      {targetId && (
        <div>
          <p className="text-sm font-semibold">Какой ранг спросить?</p>
          <p className="text-xs opacity-60">
            Можно спрашивать только ранг из вашей руки.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {myRanks.map((rank) => (
              <button
                key={rank}
                type="button"
                onClick={() => ask(rank)}
                className="rounded-md border border-[var(--card-border)] bg-white px-3 py-1.5 text-sm font-semibold transition hover:border-[var(--accent)] dark:bg-zinc-800"
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

function TargetButton({
  player,
  selected,
  onClick,
}: {
  player: PublicPlayer;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-3 py-1.5 text-sm transition",
        selected
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--card-border)] bg-white hover:border-[var(--accent)] dark:bg-zinc-800",
      ].join(" ")}
    >
      {player.name} <span className="opacity-60">({player.cardsCount})</span>
    </button>
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
  const [path, setPath] = useState<"suit" | "count" | null>(null);
  const me = state.me;
  const askerCount = me.hand.filter((c) => c.rank === rank).length;
  const maxPossible = 4 - askerCount;

  const sendSuit = (suit: Suit) => {
    socket.emit("game:guess-suit", { roomId: state.roomId, suit });
  };
  const sendCount = (count: number) => {
    socket.emit("game:guess-count", { roomId: state.roomId, count });
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <p className="text-sm">
        У <span className="font-medium">{targetName}</span> есть карты ранга{" "}
        <span className="font-bold">{rank}</span>. Что уточняем?
      </p>

      {!path && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPath("suit")}
            className="flex-1 rounded-lg border border-[var(--card-border)] bg-white p-3 text-sm hover:border-[var(--accent)] dark:bg-zinc-800"
          >
            <span className="font-semibold">Масть</span>
            <span className="block text-xs opacity-60">
              забрать 1 карту, ход остаётся
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPath("count")}
            className="flex-1 rounded-lg border border-[var(--card-border)] bg-white p-3 text-sm hover:border-[var(--accent)] dark:bg-zinc-800"
          >
            <span className="font-semibold">Количество</span>
            <span className="block text-xs opacity-60">
              забрать все, но угадать каждую масть
            </span>
          </button>
        </div>
      )}

      {path === "suit" && (
        <div className="space-y-2">
          <p className="text-sm opacity-70">Назовите масть:</p>
          <div className="flex gap-2">
            {SUITS.map((suit) => (
              <button
                key={suit}
                type="button"
                onClick={() => sendSuit(suit)}
                className={[
                  "flex flex-1 flex-col items-center gap-1 rounded-lg border border-[var(--card-border)] bg-white p-3 hover:border-[var(--accent)] dark:bg-zinc-800",
                  suitColorClass(suit),
                ].join(" ")}
              >
                <span className="text-2xl">{suitSymbol(suit)}</span>
                <span className="text-xs">{suitLabel(suit)}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPath(null)}
            className="text-xs underline opacity-60"
          >
            ← назад
          </button>
        </div>
      )}

      {path === "count" && (
        <div className="space-y-2">
          <p className="text-sm opacity-70">
            Сколько карт ранга {rank} у соперника? (от 1 до {maxPossible})
          </p>
          <div className="flex gap-2">
            {Array.from({ length: maxPossible }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => sendCount(n)}
                className="flex-1 rounded-lg border border-[var(--card-border)] bg-white p-3 text-xl font-semibold hover:border-[var(--accent)] dark:bg-zinc-800"
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPath(null)}
            className="text-xs underline opacity-60"
          >
            ← назад
          </button>
        </div>
      )}
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
    <div className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
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
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                  : "border-[var(--card-border)]",
                "bg-white hover:border-[var(--accent)] dark:bg-zinc-800",
                suitColorClass(suit),
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
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:opacity-50"
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
