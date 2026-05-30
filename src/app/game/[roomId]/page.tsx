"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "@/features/game/SocketProvider";
import { AskFlow } from "@/features/game/components/AskFlow";
import { ChestsList } from "@/features/game/components/ChestsList";
import { GameLog } from "@/features/game/components/GameLog";
import { MyHand } from "@/features/game/components/MyHand";
import { WinnerOverlay } from "@/features/game/components/WinnerOverlay";
import type { ClientGameState, PublicPlayer } from "@/shared/types/game";

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
    <main className="relative h-screen w-screen overflow-hidden bg-stone-950">
      {state.status === "waiting" ? (
        <LobbyScene state={state} socket={socket} />
      ) : (
        <PlayArea
          state={state}
          socket={socket}
        />
      )}

      <Header
        roomId={roomId}
        statusText={statusLabel(state.status)}
        onLeave={() => {
          socket.emit("room:leave", { roomId });
          setSession(null);
          router.push("/lobby");
        }}
        hostId={state.hostId}
        meId={state.me.id}
        canStart={
          state.status === "waiting" &&
          state.players.length >= 2 &&
          state.players.length <= 5
        }
        canFinish={state.status === "playing"}
        onStart={() => socket.emit("room:start", { roomId })}
        onFinish={() => socket.emit("room:finish", { roomId })}
        reserveRight={state.status !== "waiting"}
      />

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
            router.push("/lobby");
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
  reserveRight,
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
  reserveRight: boolean;
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
    <header
      className={[
        "absolute left-4 top-4 z-50 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100/20 bg-[#160f0b]/82 px-4 py-2 text-amber-50 shadow-[0_18px_56px_rgba(0,0,0,0.44)] backdrop-blur-[3px]",
        reserveRight ? "right-[376px]" : "right-4",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase text-amber-50/55">комната</span>
        <span className="font-mono text-lg font-semibold tracking-widest">
          {roomId}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-amber-100/20 px-2 py-0.5 text-xs text-amber-50/78 transition hover:border-amber-200/70 hover:text-amber-50"
        >
          {copied ? "скопировано" : "скопировать ссылку"}
        </button>
        <span className="rounded-full bg-amber-100/14 px-2 py-0.5 text-xs text-amber-50/78">
          {statusText}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isHost && canStart && (
          <button
            type="button"
            onClick={onStart}
            className="rounded-md bg-amber-300 px-3 py-1.5 text-sm font-medium text-stone-950 transition hover:bg-amber-200"
          >
            Начать игру
          </button>
        )}
        {isHost && canFinish && (
          <button
            type="button"
            onClick={onFinish}
            className="rounded-md border border-red-300/60 px-3 py-1.5 text-sm text-red-100 transition hover:border-red-200 hover:bg-red-950/30"
          >
            Завершить
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="rounded-md border border-amber-100/20 px-3 py-1.5 text-sm text-amber-50/82 transition hover:border-amber-200/70 hover:text-amber-50"
        >
          Выйти
        </button>
      </div>
    </header>
  );
}

function LobbyScene({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: NonNullable<ReturnType<typeof useGameSocket>["socket"]>;
}) {
  return (
    <section
      className="game-scene-bg absolute inset-0 overflow-hidden bg-stone-950 bg-cover"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(9, 6, 5, 0.1) 0%, rgba(9, 6, 5, 0.22) 58%, rgba(9, 6, 5, 0.7) 100%), url('/game-bg.png')",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_56%_54%,rgba(255,190,96,0.08),rgba(0,0,0,0)_34%),linear-gradient(90deg,rgba(0,0,0,0.3),rgba(0,0,0,0)_25%,rgba(0,0,0,0)_75%,rgba(0,0,0,0.28))]" />
      <div className="absolute left-1/2 top-1/2 z-10 w-[520px] -translate-x-1/2 -translate-y-1/2">
        <Lobby state={state} socket={socket} />
      </div>
    </section>
  );
}

function Lobby({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: NonNullable<ReturnType<typeof useGameSocket>["socket"]>;
}) {
  const isHost = state.hostId === state.me.id;
  const canAddBot = isHost && state.players.length < 5;

  return (
    <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-lg font-semibold">Игроки ({state.players.length}/5)</h2>
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
              {p.isBot && (
                <span className="rounded-full bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  бот
                </span>
              )}
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
      {canAddBot && (
        <button
          type="button"
          onClick={() => socket.emit("room:add-bot", { roomId: state.roomId })}
          className="mt-3 w-full rounded-lg border border-amber-200/40 px-3 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-200 hover:bg-amber-950/30"
        >
          + Добавить бота
        </button>
      )}
    </section>
  );
}

function PlayArea({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: NonNullable<ReturnType<typeof useGameSocket>["socket"]>;
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

  return (
    <section
      className="game-scene-bg absolute inset-0 overflow-hidden bg-stone-950 bg-cover"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(9, 6, 5, 0.06) 0%, rgba(9, 6, 5, 0.16) 58%, rgba(9, 6, 5, 0.58) 100%), url('/game-bg.png')",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_56%_54%,rgba(255,190,96,0.08),rgba(0,0,0,0)_34%),linear-gradient(90deg,rgba(0,0,0,0.28),rgba(0,0,0,0)_25%,rgba(0,0,0,0)_75%,rgba(0,0,0,0.26))]" />

      {isChoosingTarget && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-black/48" />
      )}

      <div className="absolute left-4 top-20 z-30 flex items-center gap-2 rounded-xl border border-amber-200/20 bg-zinc-950/62 px-3 py-2 text-sm text-amber-50 shadow-lg backdrop-blur-[2px]">
        <span>
          <span className="text-amber-100/60">колода:</span>{" "}
          <span className="font-semibold">{state.deckCount}</span>
        </span>
        <span className="h-5 w-px bg-amber-100/20" />
        <span>
          <span className="text-amber-100/60">сундуки:</span>{" "}
          <span className="font-semibold">
            {state.players.reduce((s, p) => s + p.chests.length, 0)}/13
          </span>
        </span>
      </div>

      <div className="absolute right-0 top-0 z-40 h-full w-[360px]">
        <GameLog items={state.log} variant="table" />
      </div>

      <MascotHint />

      <div className="game-image-layer pointer-events-none absolute z-30">
        {opponents.slice(0, OPPONENT_SEAT_SLOTS.length).map((player, index) => {
          const isSelectable =
            isOwnAskStage && possibleTargets.some((p) => p.id === player.id);

          return (
            <TableSeat
              key={player.id}
              player={player}
              isCurrent={state.currentPlayerId === player.id}
              isSelectable={isSelectable}
              isSelected={activeTargetId === player.id}
              isDimmed={isChoosingTarget && !isSelectable}
              slot={OPPONENT_SEAT_SLOTS[index]}
              onSelect={() => setSelectedTargetId(player.id)}
            />
          );
        })}

        <div className="game-table-control pointer-events-auto absolute z-40 -translate-x-1/2 -translate-y-1/2">
          <AskFlow
            state={state}
            socket={socket}
            selectedTargetId={activeTargetId}
            onTargetSelect={setSelectedTargetId}
          />
        </div>

        <MySeat state={state} />
      </div>
    </section>
  );
}

function MascotHint() {
  return (
    <aside className="game-mascot pointer-events-none absolute z-[45]">
      <div className="game-mascot-bubble absolute rounded-[22px] border-2 border-stone-900 bg-amber-50 px-4 py-3 text-sm font-semibold leading-snug text-stone-900 shadow-[0_12px_30px_rgba(0,0,0,0.38)]">
        Выбирай соперника за столом. Я подскажу, если что.
        <span className="absolute -bottom-3 left-10 h-6 w-6 rotate-45 border-b-2 border-r-2 border-stone-900 bg-amber-50" />
      </div>
      <img
        src="/mascot.png"
        alt="Маскот игры"
        className="game-mascot-image h-auto select-none drop-shadow-[0_20px_28px_rgba(0,0,0,0.5)]"
        draggable={false}
      />
    </aside>
  );
}

interface OpponentSeatSlot {
  positionClassName: string;
  tiltClassName: string;
}

const OPPONENT_SEAT_SLOTS: OpponentSeatSlot[] = [
  {
    positionClassName: "game-seat-slot-1",
    tiltClassName: "-rotate-3",
  },
  {
    positionClassName: "game-seat-slot-2",
    tiltClassName: "-rotate-1",
  },
  {
    positionClassName: "game-seat-slot-3",
    tiltClassName: "rotate-1",
  },
  {
    positionClassName: "game-seat-slot-4",
    tiltClassName: "rotate-3",
  },
];

function TableSeat({
  player,
  isCurrent,
  isSelectable,
  isSelected,
  isDimmed,
  slot,
  onSelect,
}: {
  player: PublicPlayer;
  isCurrent: boolean;
  isSelectable: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  slot: OpponentSeatSlot;
  onSelect: () => void;
}) {
  const className = [
    "game-player-seat pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2.5 py-2 text-left text-amber-50 shadow-[0_18px_48px_rgba(0,0,0,0.44)] transition",
    isSelectable ? "z-30 cursor-pointer" : "z-10",
    isDimmed ? "opacity-45" : "opacity-100",
    "bg-[#1d130d]/90",
    isSelected
      ? "border-amber-200 ring-2 ring-amber-200/70"
      : isCurrent
        ? "border-amber-300/80 ring-2 ring-amber-300/45"
        : isSelectable
          ? "border-amber-200/60 ring-2 ring-amber-200/30 hover:border-amber-100 hover:ring-amber-100/50"
          : "border-amber-100/18",
    slot.positionClassName,
    slot.tiltClassName,
  ].join(" ");

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={[
              "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold shadow-inner",
              player.connected
                ? "border-emerald-200/40 bg-emerald-900/65 text-emerald-50"
                : "border-zinc-300/20 bg-zinc-900/70 text-zinc-300",
            ].join(" ")}
            title={player.connected ? "онлайн" : "офлайн"}
          >
            {player.name.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">
              {player.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-50/62">
              {player.isBot && <span className="text-amber-200">бот</span>}
              {player.isHost && <span>хост</span>}
              {!player.connected && <span>офлайн</span>}
            </div>
          </div>
        </div>
        {isCurrent && (
          <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-semibold text-stone-950">
            ход
          </span>
        )}
      </div>

      <MiniCardFan count={player.cardsCount} />

      <div className="mt-2 border-t border-amber-100/12 pt-2">
        <ChestsList chests={player.chests} />
      </div>
    </>
  );

  if (isSelectable) {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {content}
      </button>
    );
  }

  return (
    <article className={className}>
      {content}
    </article>
  );
}

function MiniCardFan({ count }: { count: number }) {
  const visibleCards = Array.from({ length: Math.min(count, 5) });

  return (
    <div className="mt-2 flex h-8 items-end">
      {visibleCards.map((_, index) => (
        <span
          key={index}
          className="h-7 w-5 rounded-[4px] border border-emerald-950/70 bg-gradient-to-br from-emerald-700 to-emerald-950 shadow-sm"
          style={{
            marginLeft: index === 0 ? 0 : -8,
            transform: `rotate(${(index - visibleCards.length / 2) * 4}deg)`,
          }}
        />
      ))}
      {count > 5 && (
        <span className="ml-2 self-center rounded-full border border-amber-100/14 bg-stone-950/32 px-1.5 py-0.5 text-[10px] text-amber-50/72">
          {count} карт
        </span>
      )}
    </div>
  );
}

function MySeat({ state }: { state: ClientGameState }) {
  const isCurrent = state.currentPlayerId === state.me.id;

  return (
    <section
      className={[
        "game-my-seat absolute bottom-4 z-10 w-[700px] -translate-x-1/2 rounded-2xl border bg-[#160f0b]/82 p-2.5 text-amber-50 shadow-[0_24px_80px_rgba(0,0,0,0.52)] backdrop-blur-[3px]",
        isCurrent
          ? "border-amber-300/85 ring-2 ring-amber-300/40"
          : "border-amber-100/18",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-200/40 bg-amber-700/70 text-sm font-semibold text-amber-50 shadow-inner">
            {state.me.name.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {state.me.name}
            </h3>
            <p className="text-xs text-amber-50/62">ваше место за столом</p>
          </div>
          {isCurrent && (
            <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-stone-950">
              ваш ход
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="shrink-0 text-amber-50/62">сундуки:</span>
          <ChestsList chests={state.me.chests} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-amber-100/12 bg-stone-950/26 p-2">
        <MyHand hand={state.me.hand} compact />
      </div>
    </section>
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
  const { socket, connected, error, clearError, name: savedName } =
    useGameSocket();
  const [name, setName] = useState("");

  useEffect(() => {
    if (savedName) setName(savedName);
  }, [savedName]);

  if (hasSession) {
    return (
      <main
        className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-stone-950 bg-cover bg-center px-6 py-10 text-amber-50"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(8, 6, 5, 0.78) 0%, rgba(8, 6, 5, 0.44) 42%, rgba(8, 6, 5, 0.2) 72%), linear-gradient(180deg, rgba(8, 6, 5, 0.1) 0%, rgba(8, 6, 5, 0.56) 100%), url('/welcome-bg.png')",
        }}
      >
        <p className="rounded-2xl border border-amber-100/20 bg-[#160f0b]/88 px-5 py-4 text-sm text-amber-50/70 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
          Возвращаю в комнату {roomId}…
        </p>
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
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-stone-950 bg-cover bg-center px-6 py-10 text-amber-50"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(8, 6, 5, 0.78) 0%, rgba(8, 6, 5, 0.44) 42%, rgba(8, 6, 5, 0.2) 72%), linear-gradient(180deg, rgba(8, 6, 5, 0.1) 0%, rgba(8, 6, 5, 0.56) 100%), url('/welcome-bg.png')",
      }}
    >
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-amber-100/20 bg-[#160f0b]/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
        <h1 className="text-2xl font-semibold">Войти в комнату {roomId}</h1>
        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-amber-50/86">
            Имя
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
            className="w-full rounded-lg border border-amber-100/20 bg-amber-50 px-3 py-2 text-stone-950 outline-none transition placeholder:text-stone-500 focus:border-amber-300"
          />
        </div>
        <button
          type="button"
          disabled={!connected || !name.trim()}
          onClick={handleJoin}
          className="mt-4 w-full rounded-lg bg-amber-300 px-4 py-3 font-medium text-stone-950 transition hover:bg-amber-200 disabled:opacity-50"
        >
          Войти
        </button>
        {error && (
          <div className="mt-4 rounded-lg border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100">
            {error}{" "}
            <button onClick={clearError} type="button" className="underline">
              ок
            </button>
          </div>
        )}
        {!connected && (
          <p className="mt-4 text-center text-xs text-amber-50/55">
            подключаюсь…
          </p>
        )}
      </section>
    </main>
  );
}
