"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "@/features/game/SocketProvider";

export default function HomePage() {
  const router = useRouter();
  const { socket, connected, state, error, clearError, session, setSession } =
    useGameSocket();

  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState<"idle" | "creating" | "joining">("idle");

  useEffect(() => {
    if (state?.roomId) {
      router.push(`/game/${state.roomId}`);
    }
  }, [state?.roomId, router]);

  const handleCreate = () => {
    if (!socket || !name.trim()) return;
    setMode("creating");
    setSession(null);
    socket.emit("room:create", { playerName: name.trim() });
  };

  const handleJoin = () => {
    if (!socket || !name.trim() || !roomId.trim()) return;
    setMode("joining");
    setSession(null);
    socket.emit("room:join", {
      roomId: roomId.trim().toUpperCase(),
      playerName: name.trim(),
    });
  };

  const sessionInfo = session && !state;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Сундук</h1>
        <p className="text-sm opacity-70">
          Карточная игра «Сундук / Клад» для 2–4 игроков.
        </p>
      </header>

      {sessionInfo && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50/40 p-3 text-sm dark:bg-amber-900/20">
          Ищу комнату {session.roomId}…{" "}
          <button
            className="underline"
            onClick={() => setSession(null)}
            type="button"
          >
            забыть
          </button>
        </div>
      )}

      <div className="space-y-3">
        <label className="block text-sm font-medium">Имя</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Игрок..."
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-base outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          disabled={!connected || !name.trim() || mode !== "idle"}
          onClick={handleCreate}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-white transition disabled:opacity-50"
        >
          Создать комнату
        </button>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-[var(--card-border)]" />
          <span className="text-xs opacity-60">или</span>
          <div className="h-px flex-1 bg-[var(--card-border)]" />
        </div>

        <div className="space-y-2">
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            placeholder="Код комнаты (ABC123)"
            maxLength={6}
            className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-base uppercase tracking-widest outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            disabled={
              !connected || !name.trim() || !roomId.trim() || mode !== "idle"
            }
            onClick={handleJoin}
            className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 font-medium transition disabled:opacity-50"
          >
            Войти в комнату
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/40 bg-red-50/40 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}{" "}
          <button
            className="underline"
            onClick={() => {
              clearError();
              setMode("idle");
            }}
            type="button"
          >
            ок
          </button>
        </div>
      )}

      {!connected && (
        <div className="text-center text-xs opacity-60">подключаюсь…</div>
      )}
    </main>
  );
}
