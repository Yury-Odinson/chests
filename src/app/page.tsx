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
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-stone-950 bg-cover bg-center px-6 py-10 text-amber-50"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(8, 6, 5, 0.78) 0%, rgba(8, 6, 5, 0.44) 42%, rgba(8, 6, 5, 0.2) 72%), linear-gradient(180deg, rgba(8, 6, 5, 0.1) 0%, rgba(8, 6, 5, 0.56) 100%), url('/welcome-bg.png')",
      }}
    >
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-amber-100/20 bg-[#160f0b]/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Сундук</h1>
          <p className="text-sm text-amber-50/70">
            Карточная игра «Сундук / Клад» для 2–5 игроков.
          </p>
        </header>

        {sessionInfo && (
          <div className="mt-6 rounded-lg border border-amber-300/35 bg-amber-200/10 p-3 text-sm text-amber-50">
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

        <div className="mt-8 space-y-3">
          <label className="block text-sm font-medium text-amber-50/86">
            Имя
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Игрок..."
            className="w-full rounded-lg border border-amber-100/20 bg-amber-50 px-3 py-2 text-base text-stone-950 outline-none transition placeholder:text-stone-500 focus:border-amber-300"
          />
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={!connected || !name.trim() || mode !== "idle"}
            onClick={handleCreate}
            className="w-full rounded-lg bg-amber-300 px-4 py-3 font-medium text-stone-950 transition hover:bg-amber-200 disabled:opacity-50"
          >
            Создать комнату
          </button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-amber-100/18" />
            <span className="text-xs text-amber-50/55">или</span>
            <div className="h-px flex-1 bg-amber-100/18" />
          </div>

          <div className="space-y-2">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Код комнаты (ABC123)"
              maxLength={6}
              className="w-full rounded-lg border border-amber-100/20 bg-amber-50 px-3 py-2 text-base uppercase tracking-widest text-stone-950 outline-none transition placeholder:text-stone-500 focus:border-amber-300"
            />
            <button
              type="button"
              disabled={
                !connected || !name.trim() || !roomId.trim() || mode !== "idle"
              }
              onClick={handleJoin}
              className="w-full rounded-lg border border-amber-100/20 bg-stone-950/32 px-4 py-3 font-medium text-amber-50 transition hover:border-amber-200/70 disabled:opacity-50"
            >
              Войти в комнату
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100">
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
          <div className="mt-4 text-center text-xs text-amber-50/55">
            подключаюсь…
          </div>
        )}
      </section>
    </main>
  );
}
