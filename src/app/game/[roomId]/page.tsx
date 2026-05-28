"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "@/features/game/SocketProvider";
import { AskFlow } from "@/features/game/components/AskFlow";
import { ChestsList } from "@/features/game/components/ChestsList";
import { GameLog } from "@/features/game/components/GameLog";
import { MyHand } from "@/features/game/components/MyHand";
import { OpponentTile } from "@/features/game/components/OpponentTile";
import { WinnerOverlay } from "@/features/game/components/WinnerOverlay";

export default function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const {
    socket,
    connected,
    state,
    error,
    recentLogs,
    session,
    setSession,
    clearError,
  } = useGameSocket();

  const matches = state?.roomId === roomId;
  const haveSession = session?.roomId === roomId;

  // If we navigated here without state and have no matching session → join form
  if (!matches) {
    return (
      <JoinPrompt
        roomId={roomId}
        hasSession={haveSession}
        onJoined={() => {}}
      />
    );
  }

  if (!socket) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <Header
        roomId={roomId}
        statusText={statusLabel(state.status)}
        onLeave={() => {
          socket.emit("room:leave", { roomId });
          setSession(null);
          router.push("/");
        }}
        hostId={state.hostId}
        meId={state.me.id}
        canStart={
          state.status === "waiting" &&
          state.players.length >= 2 &&
          state.players.length <= 4
        }
        canFinish={state.status === "playing"}
        onStart={() => socket.emit("room:start", { roomId })}
        onFinish={() => socket.emit("room:finish", { roomId })}
      />

      {state.status === "waiting" ? (
        <Lobby state={state} />
      ) : (
        <PlayArea
          state={state}
          socket={socket}
        />
      )}

      {error && (
        <div className="fixed inset-x-0 top-2 z-30 mx-auto w-fit max-w-sm rounded-lg border border-red-400/40 bg-red-50 px-3 py-2 text-sm text-red-700 shadow dark:bg-red-900/40 dark:text-red-200">
          {error}{" "}
          <button className="underline" type="button" onClick={clearError}>
            ок
          </button>
        </div>
      )}

      {!connected && (
        <div className="fixed inset-x-0 bottom-2 z-30 mx-auto w-fit rounded-md bg-zinc-900/80 px-3 py-1 text-xs text-white">
          переподключаюсь…
        </div>
      )}

      {state.status === "finished" && (
        <WinnerOverlay
          state={state}
          onClose={() => {
            setSession(null);
            router.push("/");
          }}
        />
      )}
    </main>
  );
}

function statusLabel(status: string): string {
  if (status === "waiting") return "ожидание";
  if (status === "playing") return "игра идёт";
  return "завершена";
}

function Header({
  roomId,
  statusText,
  onLeave,
  hostId,
  meId,
  canStart,
  canFinish,
  onStart,
  onFinish,
}: {
  roomId: string;
  statusText: string;
  onLeave: () => void;
  hostId: string;
  meId: string;
  canStart: boolean;
  canFinish: boolean;
  onStart: () => void;
  onFinish: () => void;
}) {
  const isHost = hostId === meId;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase opacity-60">комната</span>
        <span className="font-mono text-lg font-semibold tracking-widest">
          {roomId}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-[var(--card-border)] px-2 py-0.5 text-xs hover:border-[var(--accent)]"
        >
          {copied ? "скопировано" : "скопировать ссылку"}
        </button>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">
          {statusText}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isHost && canStart && (
          <button
            type="button"
            onClick={onStart}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Начать игру
          </button>
        )}
        {isHost && canFinish && (
          <button
            type="button"
            onClick={onFinish}
            className="rounded-md border border-red-400/60 px-3 py-1.5 text-sm text-red-700 dark:text-red-300"
          >
            Завершить
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="rounded-md border border-[var(--card-border)] px-3 py-1.5 text-sm"
        >
          Выйти
        </button>
      </div>
    </header>
  );
}

function Lobby({
  state,
}: {
  state: import("@/shared/types/game").ClientGameState;
}) {
  return (
    <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-lg font-semibold">Игроки ({state.players.length}/4)</h2>
      <p className="text-xs opacity-60">
        Минимум 2 игрока. Хост запускает партию.
      </p>
      <ul className="mt-3 space-y-2">
        {state.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-[var(--card-border)] px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${p.connected ? "bg-emerald-500" : "bg-zinc-400"}`}
              />
              <span className="font-medium">{p.name}</span>
              {p.id === state.hostId && (
                <span className="text-xs opacity-60">(хост)</span>
              )}
              {p.id === state.me.id && (
                <span className="text-xs text-[var(--accent)]">— это вы</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayArea({
  state,
  socket,
}: {
  state: import("@/shared/types/game").ClientGameState;
  socket: NonNullable<ReturnType<typeof useGameSocket>["socket"]>;
}) {
  const opponents = state.players.filter((p) => p.id !== state.me.id);
  return (
    <>
      <section className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {opponents.map((p) => (
          <OpponentTile
            key={p.id}
            player={p}
            isCurrent={state.currentPlayerId === p.id}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <AskFlow state={state} socket={socket} />
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-sm">
            <span>
              <span className="opacity-60">колода:</span>{" "}
              <span className="font-semibold">{state.deckCount}</span>
            </span>
            <span>
              <span className="opacity-60">сундуков собрано:</span>{" "}
              <span className="font-semibold">
                {state.players.reduce((s, p) => s + p.chests.length, 0)}/13
              </span>
            </span>
          </div>
        </div>
        <div className="h-96 md:h-[420px]">
          <GameLog items={state.log} />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Ваши карты</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="opacity-60">сундуки:</span>
            <ChestsList chests={state.me.chests} />
          </div>
        </div>
        <MyHand hand={state.me.hand} />
      </section>
    </>
  );
}

function JoinPrompt({
  roomId,
  hasSession,
}: {
  roomId: string;
  hasSession: boolean;
  onJoined: () => void;
}) {
  const { socket, connected, error, clearError } = useGameSocket();
  const [name, setName] = useState("");

  if (hasSession) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-12">
        <p className="text-sm opacity-70">Возвращаю в комнату {roomId}…</p>
      </main>
    );
  }

  const handleJoin = () => {
    if (!socket || !name.trim()) return;
    socket.emit("room:join", {
      roomId,
      playerName: name.trim(),
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Войти в комнату {roomId}</h1>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя"
        className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 outline-none focus:border-[var(--accent)]"
      />
      <button
        type="button"
        disabled={!connected || !name.trim()}
        onClick={handleJoin}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        Войти
      </button>
      {error && (
        <div className="rounded-lg border border-red-400/40 bg-red-50/40 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}{" "}
          <button onClick={clearError} type="button" className="underline">
            ок
          </button>
        </div>
      )}
      {!connected && (
        <p className="text-center text-xs opacity-60">подключаюсь…</p>
      )}
    </main>
  );
}
