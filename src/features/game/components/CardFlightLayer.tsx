"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, ClientGameState } from "@/shared/types/game";

/**
 * Animates cards moving between places on the table. The server only sends
 * state snapshots, so this is purely a client-side derivation: on each new
 * state we diff card counts against the previous one to figure out who lost
 * cards (sources) and who gained them (dests), then fly a card from each
 * source anchor to each dest anchor.
 *
 * We can only show a real face for cards that land in OUR hand (we never see
 * opponents' cards); everything else flies as a card back.
 */

const FLIGHT_MS = 520;

interface Flight {
  id: string;
  fromAnchor: string;
  toAnchor: string;
  /** Concrete card if we know it (lands in our hand), else a face-down back. */
  card: Card | null;
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

/**
 * Diff two states into a list of flights. Sources are entities whose card
 * count dropped (players + the deck); dests are players whose count rose.
 * A turn moves cards in one direction, so this is usually one source → one
 * dest, but we match generally to stay robust.
 */
function diffFlights(
  prev: ClientGameState,
  curr: ClientGameState
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

  if (sources.length === 0 || dests.length === 0) return [];

  // Faces we can attach: only the concrete cards that arrived in our hand.
  const myNewCards = newCardsInMyHand(prev, curr);
  let faceIdx = 0;

  const flights: Flight[] = [];
  let si = 0;
  let sRemaining = sources[0]?.n ?? 0;

  for (const dest of dests) {
    for (let k = 0; k < dest.n; k++) {
      // Advance to a source that still has cards to give.
      while (si < sources.length && sRemaining === 0) {
        si++;
        sRemaining = sources[si]?.n ?? 0;
      }
      if (si >= sources.length) break;

      const card = dest.isMe ? myNewCards[faceIdx++] ?? null : null;
      flights.push({
        id: `${sources[si].anchor}->${dest.anchor}-${k}-${curr.log.length}`,
        fromAnchor: sources[si].anchor,
        toAnchor: dest.anchor,
        card,
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

    const flights = diffFlights(prev, state);
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

    const timer = setTimeout(() => {
      setRendered((cur) =>
        cur.filter((r) => !resolved.some((x) => x.id === r.id))
      );
    }, FLIGHT_MS + 80);

    return () => clearTimeout(timer);
  }, [state]);

  if (rendered.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {rendered.map((f) => (
        <FlyingCard key={f.id} flight={f} />
      ))}
    </div>
  );
}

function FlyingCard({ flight }: { flight: RenderedFlight }) {
  const [moved, setMoved] = useState(false);

  // Kick the transition on the next frame so the start position paints first.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMoved(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pos = moved ? flight.to : flight.from;
  const W = 44;
  const H = 62;

  return (
    <div
      className="absolute"
      style={{
        left: pos.x - W / 2,
        top: pos.y - H / 2,
        width: W,
        height: H,
        transform: `scale(${moved ? 1 : 0.9})`,
        opacity: moved ? 1 : 0.85,
        transition: `left ${FLIGHT_MS}ms cubic-bezier(0.22,0.61,0.36,1), top ${FLIGHT_MS}ms cubic-bezier(0.22,0.61,0.36,1), transform ${FLIGHT_MS}ms ease-out, opacity 160ms ease-out`,
      }}
    >
      {flight.card ? (
        <FaceCard card={flight.card} />
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

function FaceCard({ card }: { card: Card }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div
      className={[
        "flex h-full w-full flex-col items-center justify-center rounded-[5px] border border-stone-300 bg-amber-50 shadow-[0_8px_22px_rgba(0,0,0,0.5)]",
        red ? "text-red-600" : "text-stone-900",
      ].join(" ")}
    >
      <span className="text-sm font-bold leading-none">{card.rank}</span>
      <span className="text-base leading-none">{SUIT_GLYPH[card.suit]}</span>
    </div>
  );
}
