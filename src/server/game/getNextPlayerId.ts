import type { GameRoom } from "@/shared/types/game";

export function getNextPlayerId(
  room: GameRoom,
  fromPlayerId: string
): string | null {
  const players = room.players;
  if (players.length === 0) return null;
  const startIndex = players.findIndex((p) => p.id === fromPlayerId);
  if (startIndex === -1) return null;

  const deckEmpty = room.deck.length === 0;

  for (let step = 1; step <= players.length; step++) {
    const idx = (startIndex + step) % players.length;
    const candidate = players[idx];
    if (!candidate.connected) continue;
    if (deckEmpty && candidate.hand.length === 0) continue;
    return candidate.id;
  }

  return null;
}
