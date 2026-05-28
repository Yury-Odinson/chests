import type { GameLogItem, GameRoom } from "@/shared/types/game";
import { collectChests } from "./collectChests";
import { findPlayer, makeLog, updatePlayer } from "./helpers";

export function drawCard(
  room: GameRoom,
  playerId: string
): { room: GameRoom; logs: GameLogItem[]; drawn: boolean } {
  if (room.deck.length === 0) {
    return { room, logs: [], drawn: false };
  }
  const player = findPlayer(room, playerId);
  if (!player) {
    return { room, logs: [], drawn: false };
  }

  const card = room.deck[0];
  const afterDraw: GameRoom = {
    ...updatePlayer(room, playerId, (p) => ({
      ...p,
      hand: [...p.hand, card],
    })),
    deck: room.deck.slice(1),
  };

  const drawLog = makeLog(`**${player.name}** взял карту из колоды`, "muted");
  const chest = collectChests(afterDraw, playerId);

  return {
    room: chest.room,
    logs: [drawLog, ...chest.logs],
    drawn: true,
  };
}
