<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: «Сундук / Клад» — online card game

A small multiplayer card game built for fun. 2–5 players join a room, ask each other for cards, collect rank sets («сундуки»), and the player with the most sets wins.

## Tech stack

- **Next.js 16.2.6** (App Router, React 19) — single process via a **custom server** (`server.ts`) that hosts both Next and Socket.IO on the same port. See `node_modules/next/dist/docs/01-app/02-guides/custom-server.md`.
- **Socket.IO** for real-time transport. Game engine is decoupled from sockets.
- **TypeScript strict**. Pure functions for the engine.
- **Tailwind CSS + shadcn/ui** for UI (to be added).
- **Vitest** for engine tests.
- **In-memory** room store via `Map`. No DB.

## Architecture rules

- **Server is the single source of truth.** Never trust client state. Validate every action.
- The **game engine** is pure (in `src/server/game/`). It does not import Socket.IO or React.
- Socket.IO handlers in `src/server/socket/` are thin: parse → validate → call engine → emit per-player state.
- Each player gets their own **filtered** `ClientGameState` — never broadcast raw `GameRoom`.
- Shared TypeScript types live in `src/shared/types/` so client and server stay in sync.

## Game rules (authoritative)

### Setup

- **Deck:** 52 cards. Suits: `hearts`, `diamonds`, `clubs`, `spades`. Ranks: `2`–`10`, `J`, `Q`, `K`, `A`.
- **Players:** 2–5 per room.
- **Initial hand size:**
  - 2–3 players → 7 cards each
  - 4–5 players → 5 cards each
- Remaining cards stay in the deck.

### Turn flow

On their turn the active player:

1. **Picks a target player.**
2. **Picks a rank** — must be a rank they already hold in their own hand.
3. Server checks whether the target has any card of that rank.
   - **Target has none** → active player draws 1 card from the deck (if non-empty), turn passes to next active player.
   - **Target has at least one** → continue to step 4.
4. Active player must **name how many cards of that rank the target holds (1–4).**
   - Count wrong → the log states only that the guess was wrong (the real count is **not** revealed); active draws 1 card; turn passes.
   - Count correct → active must also name **all suits** of those cards.
     - All suits correct → active takes all those cards; turn **continues**.
     - Any suit wrong → the incorrectly-named suits are publicly revealed; active draws 1 card; turn passes.

There is no shortcut for taking a single card: you always have to guess the
exact count first, then the suits.

### Chests

- A **сундук** = all 4 cards of one rank in a single player's hand.
- Auto-collected the moment a player holds the 4th card of a rank: cards are removed from the hand, the rank is added to `player.chests`, a log entry is emitted.
- There are 13 possible chests total.

### Start of turn

- If the active player has 0 cards and the deck is non-empty, auto-draw 1 card before they act.
- If the active player has 0 cards and the deck is empty, **skip** them.

### End of game

- Game ends when **all 13 chests are collected**, OR
- The **host** clicks «Завершить партию» (escape hatch for theoretical deadlocks).
- Winner = player with the most chests. Ties → all tied players are winners.

## Connection model

- **Player identity** is server-generated `playerId`. Client persists it in `localStorage` alongside `roomId`.
- **Reconnect** is supported in MVP: on socket connect, client emits `room:rejoin` with stored `{ roomId, playerId }`. Server re-binds the new `socketId` to the existing player and re-sends state.
- **Disconnect during game**: player is marked `connected: false`, **kept in the room**, their cards stay with them. When it's their turn while disconnected, the turn is **skipped** (passed to the next connected player) until they return.
- **Host left in lobby** (before start): if any player remains, the next-joined player becomes host. If empty, room is destroyed.

## Public log policy

- The log reveals what is part of public gameplay: who asked whom for which rank, whether the rank was present, whether the suit/count guess succeeded, and any revealed info from a failed guess (per the rules above).
- The log does **not** reveal hidden state (full hands, deck order).
- Log is capped at the last 100 entries to avoid unbounded growth.

## Client may receive

- Own hand and own chests.
- For each player: id, name, card count, collected chests, connected flag.
- Current `currentPlayerId`, `deckCount`, `status`, `winnerIds`, public `log`.
- Pending interaction state when a 2nd-stage guess is in progress (whose turn it is to specify suit/count).

## Client must never receive

- Other players' hands.
- Full deck contents or its order.
- Server-internal random seed / room object.

## Conventions

- **Card IDs:** `` `${rank}_of_${suit}` `` (e.g. `7_of_hearts`).
- **Room IDs:** 6 uppercase alphanumeric chars, e.g. `ABC123`.
- **Player IDs:** generated on server (`nanoid`).
- UI text is in Russian.
- Stable terms in the codebase: `chest` (English) in code, «сундук» in UI.

## Out of scope for MVP

Do not implement unless explicitly asked: authentication, database, payments, bots, matchmaking, chat, profile pages, rating system, mobile app, animations beyond basic transitions, Redis/Postgres.

## File layout

```
src/
  app/                       # Next App Router pages
    page.tsx                 # home (create / join room)
    game/[roomId]/page.tsx   # lobby + game view
  features/game/             # client-side game UI
    components/
    hooks/useGameSocket.ts
  server/                    # server-only code
    game/                    # pure engine
      createDeck.ts
      shuffleDeck.ts
      createRoom.ts
      startGame.ts
      askRank.ts             # step 3: does target have rank?
      guessCount.ts          # step 4a: name the count
      guessAllSuits.ts       # step 4b: name all suits after correct count
      drawCard.ts
      collectChests.ts
      getNextPlayerId.ts
      getStateForPlayer.ts
      finishGame.ts
      __tests__/
    rooms/roomsStore.ts
    socket/socketServer.ts
    socket/handlers.ts
  shared/
    types/game.ts            # Card, Rank, Suit, GameRoom, ClientGameState, ...
    types/events.ts          # socket event payload types
server.ts                    # custom Next + Socket.IO entry
```

## Socket events

Client → server:
- `room:create` `{ playerName }`
- `room:join` `{ roomId, playerName }`
- `room:rejoin` `{ roomId, playerId }`
- `room:leave`
- `room:start` `{ roomId }`
- `room:finish` `{ roomId }` (host only)
- `game:ask-rank` `{ roomId, targetPlayerId, rank }`
- `game:guess-count` `{ roomId, count }`
- `game:guess-suits` `{ roomId, suits: Suit[] }` — names all suits after correct count

Server → client:
- `room:created` `{ roomId, playerId }`
- `room:joined` `{ roomId, playerId }`
- `game:state` `ClientGameState`
- `game:log` `GameLogItem`
- `game:error` `{ message }`

## Implementation order

1. Shared types (cards, room, client state, events).
2. Pure engine modules + Vitest tests.
3. Custom server: `server.ts` wiring Next + Socket.IO.
4. Room store, socket handlers.
5. Install Tailwind + shadcn/ui.
6. Client: home page, lobby, game view, socket hook.
7. Manual smoke test (two browser windows), polish.

Do not start UI before the engine is tested.
