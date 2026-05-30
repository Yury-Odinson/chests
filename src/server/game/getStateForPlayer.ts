import type {
  ClientGameState,
  GameRoom,
  PublicPlayer,
} from "@/shared/types/game";
import { findPlayer } from "./helpers";

export function getStateForPlayer(
  room: GameRoom,
  playerId: string
): ClientGameState | null {
  const me = findPlayer(room, playerId);
  if (!me) return null;

  const players: PublicPlayer[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    cardsCount: p.hand.length,
    chests: p.chests,
    connected: p.connected,
    isHost: p.id === room.hostId,
    isBot: p.isBot,
  }));

  return {
    roomId: room.id,
    status: room.status,
    hostId: room.hostId,
    currentPlayerId: room.currentPlayerId,
    deckCount: room.deck.length,
    me: {
      id: me.id,
      name: me.name,
      hand: me.hand,
      chests: me.chests,
    },
    players,
    pendingGuess: room.pendingGuess,
    winnerIds: room.winnerIds,
    log: room.log,
  };
}
