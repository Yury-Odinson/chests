"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, ClientGameState, GameLogItem } from "@/shared/types/game";

/**
 * Animates cards moving between places on the table. The server only sends
 * state snapshots, so this is mostly a client-side derivation: on each new
 * state we diff card counts against the previous one to figure out who lost
 * cards (sources) and who gained them (dests), then fly a card from each
 * source anchor to each dest anchor.
 *
 * Two flavours of flight:
 *  - A public capture (correct count + suits) arrives with a `transfer` on its
 *    log entry: the exact cards are public knowledge, so we show them face-up,
 *    let them hover and grow at the current owner for a beat, then fly them to
 *    the winner.
 *  - Everything else (deck draws, hidden movement) flies fast as a card back;
 *    a real face is only shown when those cards land in OUR own hand.
 */

// Hidden/quick flights (deck draw, etc.).
const QUICK_FLIGHT_MS = 520;

// Public capture: hover-and-grow, then a slightly longer glide.
const HOLD_MS = 1000;
const CAPTURE_FLIGHT_MS = 620;

interface Flight {
  id: string;
  fromAnchor: string;
  toAnchor: string;
  /** Concrete card if we know it (public capture, or lands in our hand). */
  card: Card | null;
  /** Public capture: hold + grow at source before flying. */
  reveal: boolean;
  /** Position within its capture group, used to fan out multiple cards. */
  spreadIndex: number;
  /** Total cards in this capture group (1–3). */
  spreadCount: number;
}

interface RenderedFlight extends Flight {
  from: Rect;
  to: Rect;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function anchorRect(name: string): Rect | null {
  const el = document.querySelector(`[data-anchor="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

/** Count of cards a player holds in a given state (handles "me" vs others). */
function cardCount(state: ClientGameState, playerId: string): number {
  if (playerId === state.me.id) return state.me.hand.length;
  return state.players.find((p) => p.id === playerId)?.cardsCount ?? 0;
}

/** Cards added to my hand between two states, matched by id. */
function newCardsInMyHand(
  prev: ClientGameState,
  curr: ClientGameState
): Card[] {
  const before = new Set(prev.me.hand.map((c) => c.id));
  return curr.me.hand.filter((c) => !before.has(c.id));
}

/** Log entries present in `curr` but not in `prev`, matched by id. */
function newLogEntries(
  prev: ClientGameState,
  curr: ClientGameState
): GameLogItem[] {
  const before = new Set(prev.log.map((l) => l.id));
  return curr.log.filter((l) => !before.has(l.id));
}

/**
 * Public captures from the new log entries. Each becomes a face-up reveal
 * flight from the loser's seat to the winner's seat.
 */
function captureFlights(
  prev: ClientGameState,
  curr: ClientGameState
): { flights: Flight[]; movedCardIds: Set<string> } {
  const flights: Flight[] = [];
  const movedCardIds = new Set<string>();

  for (const entry of newLogEntries(prev, curr)) {
    const t = entry.transfer;
    if (!t) continue;
    t.cards.forEach((card, k) => {
      movedCardIds.add(card.id);
      flights.push({
        id: `capture-${entry.id}-${k}`,
        fromAnchor: `seat-${t.fromPlayerId}`,
        toAnchor: `seat-${t.toPlayerId}`,
        card,
        reveal: true,
        spreadIndex: k,
        spreadCount: t.cards.length,
      });
    });
  }

  return { flights, movedCardIds };
}

/**
 * Diff two states into hidden flights (deck draws, anything not already
 * accounted for by a public capture). Sources are entities whose card count
 * dropped (players + the deck); dests are players whose count rose.
 */
function diffFlights(
  prev: ClientGameState,
  curr: ClientGameState,
  alreadyMoved: number
): Flight[] {
  const sources: { anchor: string; n: number }[] = [];
  const dests: { anchor: string; n: number; isMe: boolean }[] = [];

  // Deck only ever shrinks → pure source.
  const deckLost = prev.deckCount - curr.deckCount;
  if (deckLost > 0) sources.push({ anchor: "deck", n: deckLost });

  for (const p of curr.players) {
    const before = cardCount(prev, p.id);
    const after = cardCount(curr, p.id);
    const delta = after - before;
    if (delta < 0) sources.push({ anchor: `seat-${p.id}`, n: -delta });
    else if (delta > 0)
      dests.push({ anchor: `seat-${p.id}`, n: delta, isMe: p.id === curr.me.id });
  }

  // A public capture already moved `alreadyMoved` cards both out of a source
  // and into a dest; those net deltas are covered by the reveal flights, so
  // only animate what's left (typically the asker's 1-card deck draw is not
  // present on a capture turn, so this is usually empty).
  let remaining = alreadyMoved;
  for (const s of sources) {
    if (remaining <= 0) break;
    const cut = Math.min(s.n, remaining);
    s.n -= cut;
    remaining -= cut;
  }
  remaining = alreadyMoved;
  for (const d of dests) {
    if (remaining <= 0) break;
    const cut = Math.min(d.n, remaining);
    d.n -= cut;
    remaining -= cut;
  }

  const liveSources = sources.filter((s) => s.n > 0);
  const liveDests = dests.filter((d) => d.n > 0);
  if (liveSources.length === 0 || liveDests.length === 0) return [];

  // Faces we can attach: only the concrete cards that arrived in our hand.
  const myNewCards = newCardsInMyHand(prev, curr);
  let faceIdx = 0;

  const flights: Flight[] = [];
  let si = 0;
  let sRemaining = liveSources[0]?.n ?? 0;

  for (const dest of liveDests) {
    for (let k = 0; k < dest.n; k++) {
      while (si < liveSources.length && sRemaining === 0) {
        si++;
        sRemaining = liveSources[si]?.n ?? 0;
      }
      if (si >= liveSources.length) break;

      const card = dest.isMe ? myNewCards[faceIdx++] ?? null : null;
      flights.push({
        id: `${liveSources[si].anchor}->${dest.anchor}-${k}-${curr.log.length}`,
        fromAnchor: liveSources[si].anchor,
        toAnchor: dest.anchor,
        card,
        reveal: false,
        spreadIndex: 0,
        spreadCount: 1,
      });
      sRemaining--;
    }
  }

  return flights;
}

export function CardFlightLayer({ state }: { state: ClientGameState }) {
  const prevRef = useRef<ClientGameState | null>(null);
  const [rendered, setRendered] = useState<RenderedFlight[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (!prev) return;
    // Only animate within an ongoing game.
    if (state.status !== "playing") return;

    const capture = captureFlights(prev, state);
    const hidden = diffFlights(prev, state, capture.movedCardIds.size);
    const flights = [...capture.flights, ...hidden];
    if (flights.length === 0) return;

    // Resolve anchor positions now (post-render layout).
    const resolved: RenderedFlight[] = [];
    for (const f of flights) {
      const from = anchorRect(f.fromAnchor);
      const to = anchorRect(f.toAnchor);
      if (!from || !to) continue;
      resolved.push({ ...f, from, to });
    }
    if (resolved.length === 0) return;

    setRendered((cur) => [...cur, ...resolved]);
    // Each card removes itself when its own animation finishes (see
    // FlyingCard). We deliberately do NOT schedule removal here: this effect
    // re-runs on every new state, and its cleanup would otherwise cancel the
    // removal of a still-flying card — leaving captured cards stuck on screen.
  }, [state]);

  const removeFlight = (id: string) =>
    setRendered((cur) => cur.filter((r) => r.id !== id));

  if (rendered.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {rendered.map((f) => (
        <FlyingCard key={f.id} flight={f} onDone={removeFlight} />
      ))}
    </div>
  );
}

type Phase = "start" | "hold" | "fly";

function FlyingCard({
  flight,
  onDone,
}: {
  flight: RenderedFlight;
  onDone: (id: string) => void;
}) {
  // Hidden flights: a simple two-step start→fly. Reveal flights: start (paint
  // at source), hold (grow in place for a beat), then fly to the winner.
  const [phase, setPhase] = useState<Phase>("start");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Total on-screen lifetime, after which the card removes itself. Tied to
    // the card (not the diff effect), so incoming state updates can't cancel it
    // and leave the card stuck on screen.
    const lifespan = flight.reveal
      ? HOLD_MS + CAPTURE_FLIGHT_MS + 120
      : QUICK_FLIGHT_MS + 80;
    timers.push(setTimeout(() => onDone(flight.id), lifespan));

    if (!flight.reveal) {
      const id = requestAnimationFrame(() => setPhase("fly"));
      return () => {
        cancelAnimationFrame(id);
        timers.forEach(clearTimeout);
      };
    }
    const raf = requestAnimationFrame(() => setPhase("hold"));
    timers.push(setTimeout(() => setPhase("fly"), HOLD_MS));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flying = phase === "fly";
  const pos = flying ? flight.to : flight.from;

  // Reveal cards are bigger so they read clearly while hovering.
  const W = flight.reveal ? 60 : 44;
  const H = flight.reveal ? 84 : 62;

  // Fan multiple captured cards out horizontally so every one is visible
  // instead of stacking in a single spot. Centered: e.g. 3 cards → -1,0,+1.
  const GAP = W * 0.9;
  const spreadX = flight.reveal
    ? (flight.spreadIndex - (flight.spreadCount - 1) / 2) * GAP
    : 0;

  const scale = flight.reveal
    ? phase === "hold"
      ? 1.18
      : 1
    : flying
    ? 1
    : 0.9;

  const flightMs = flight.reveal ? CAPTURE_FLIGHT_MS : QUICK_FLIGHT_MS;
  const easing = "cubic-bezier(0.22,0.61,0.36,1)";

  return (
    <div
      className="absolute"
      style={{
        left: pos.x - W / 2 + spreadX,
        top: pos.y - H / 2,
        width: W,
        height: H,
        transform: `scale(${scale})`,
        opacity: phase === "start" ? 0.85 : 1,
        transition: [
          `left ${flightMs}ms ${easing}`,
          `top ${flightMs}ms ${easing}`,
          `transform ${flight.reveal ? 260 : flightMs}ms ease-out`,
          `opacity 160ms ease-out`,
        ].join(", "),
        zIndex: flight.reveal ? 2 + flight.spreadIndex : 1,
      }}
    >
      {flight.card ? (
        <FaceCard card={flight.card} big={flight.reveal} />
      ) : (
        <img
          src="/card-back.png"
          alt=""
          draggable={false}
          className="h-full w-full rounded-[5px] object-cover shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
        />
      )}
    </div>
  );
}

const SUIT_GLYPH: Record<Card["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

function FaceCard({ card, big = false }: { card: Card; big?: boolean }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div
      className={[
        "flex h-full w-full flex-col items-center justify-center rounded-[5px] border border-stone-300 bg-amber-50 shadow-[0_8px_22px_rgba(0,0,0,0.5)]",
        red ? "text-red-600" : "text-stone-900",
      ].join(" ")}
    >
      <span className={`${big ? "text-lg" : "text-sm"} font-bold leading-none`}>
        {card.rank}
      </span>
      <span className={`${big ? "text-xl" : "text-base"} leading-none`}>
        {SUIT_GLYPH[card.suit]}
      </span>
    </div>
  );
}
