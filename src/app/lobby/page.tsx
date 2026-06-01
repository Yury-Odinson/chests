"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "@/features/game/SocketProvider";
import type { RoomSummary } from "@/shared/types/game";

export default function LobbyPage() {
  const router = useRouter();
  const {
    socket,
    connected,
    state,
    error,
    clearError,
    name,
    hydrated,
    rooms,
    online,
    enterLobby,
    leaveLobby,
    clearRoomClosed,
    setSession,
  } = useGameSocket();

  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);

  // No name yet → back to the name screen.
  useEffect(() => {
    if (hydrated && !name.trim()) {
      router.replace("/");
    }
  }, [hydrated, name, router]);

  // Joined/created a room → go to the game view.
  useEffect(() => {
    if (state?.roomId) {
      router.push(`/game/${state.roomId}`);
    }
  }, [state?.roomId, router]);

  // Subscribe to the live room list while on this screen.
  useEffect(() => {
    clearRoomClosed();
    enterLobby();
    return () => leaveLobby();
  }, [clearRoomClosed, enterLobby, leaveLobby, connected]);

  // A failed action releases the busy state so the buttons re-enable.
  useEffect(() => {
    if (error) setBusy(false);
  }, [error]);

  const handleCreate = () => {
    if (!socket || !name.trim() || busy) return;
    setBusy(true);
    setSession(null);
    socket.emit("room:create", { playerName: name.trim() });
  };

  const handleJoin = (code: string) => {
    const target = code.trim().toUpperCase();
    if (!socket || !name.trim() || !target || busy) return;
    setBusy(true);
    setSession(null);
    socket.emit("room:join", { roomId: target, playerName: name.trim() });
  };

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-stone-950 bg-cover bg-center px-6 py-10 text-amber-50"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(8, 6, 5, 0.78) 0%, rgba(8, 6, 5, 0.44) 42%, rgba(8, 6, 5, 0.2) 72%), linear-gradient(180deg, rgba(8, 6, 5, 0.1) 0%, rgba(8, 6, 5, 0.56) 100%), url('/welcome-bg.webp')",
      }}
    >
      <section className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-100/20 bg-[#160f0b]/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Лобби</h1>
            <p className="mt-1 text-sm text-amber-50/70">
              Вы вошли как{" "}
              <span className="font-semibold text-amber-100">{name}</span>.
            </p>
            {connected && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-50/55">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                сейчас в сети:{" "}
                <span className="font-semibold text-amber-100">{online}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-md border border-amber-100/20 px-2.5 py-1 text-xs text-amber-50/70 transition hover:border-amber-200/70 hover:text-amber-50"
          >
            сменить имя
          </button>
        </header>

        <button
          type="button"
          disabled={!connected || busy}
          onClick={handleCreate}
          className="mt-6 w-full rounded-lg bg-amber-300 px-4 py-3 font-medium text-stone-950 transition hover:bg-amber-200 disabled:opacity-50"
        >
          Создать комнату
        </button>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-amber-50/86">
              Открытые комнаты
            </h2>
            <span className="text-xs text-amber-50/45">
              {rooms.length > 0 ? `${rooms.length}` : "пусто"}
            </span>
          </div>

          {rooms.length === 0 ? (
            <p className="rounded-lg border border-amber-100/12 bg-stone-950/30 px-3 py-4 text-center text-sm text-amber-50/55">
              Пока нет открытых комнат. Создайте первую!
            </p>
          ) : (
            <ul className="space-y-2">
              {rooms.map((room) => (
                <RoomRow
                  key={room.roomId}
                  room={room}
                  disabled={!connected || busy}
                  onJoin={() => handleJoin(room.roomId)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <div className="h-px flex-1 bg-amber-100/18" />
          <span className="text-xs text-amber-50/55">или по коду</span>
          <div className="h-px flex-1 bg-amber-100/18" />
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin(roomId);
            }}
            placeholder="Код (ABC123)"
            maxLength={6}
            className="min-w-0 flex-1 rounded-lg border border-amber-100/20 bg-amber-50 px-3 py-2 text-base uppercase tracking-widest text-stone-950 outline-none transition placeholder:text-stone-500 focus:border-amber-300"
          />
          <button
            type="button"
            disabled={!connected || !roomId.trim() || busy}
            onClick={() => handleJoin(roomId)}
            className="shrink-0 rounded-lg border border-amber-100/20 bg-stone-950/32 px-4 py-2 font-medium text-amber-50 transition hover:border-amber-200/70 disabled:opacity-50"
          >
            Войти
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100">
            {error}{" "}
            <button className="underline" onClick={clearError} type="button">
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

function RoomRow({
  room,
  disabled,
  onJoin,
}: {
  room: RoomSummary;
  disabled: boolean;
  onJoin: () => void;
}) {
  const full = room.playerCount >= room.maxPlayers;

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-amber-100/15 bg-stone-950/30 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tracking-widest text-amber-100">
            {room.roomId}
          </span>
          <span className="truncate text-xs text-amber-50/60">
            хост: {room.hostName}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-amber-50/55">
          {room.playerCount}/{room.maxPlayers} игроков
        </div>
      </div>
      <button
        type="button"
        disabled={disabled || full}
        onClick={onJoin}
        className="shrink-0 rounded-md bg-amber-300 px-3 py-1.5 text-sm font-medium text-stone-950 transition hover:bg-amber-200 disabled:opacity-40"
      >
        {full ? "полная" : "Войти"}
      </button>
    </li>
  );
}
