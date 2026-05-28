import type { GameLogItem, GameRoom, Rank } from "@/shared/types/game";
import { RANKS } from "@/shared/types/game";
import { findPlayer, makeLog, updatePlayer } from "./helpers";

export function collectChests(
  room: GameRoom,
  playerId: string
): { room: GameRoom; logs: GameLogItem[]; collected: Rank[] } {
  const player = findPlayer(room, playerId);
  if (!player) {
    return { room, logs: [], collected: [] };
  }

  const ranksToCollect: Rank[] = RANKS.filter(
    (rank) => player.hand.filter((c) => c.rank === rank).length === 4
  );

  if (ranksToCollect.length === 0) {
    return { room, logs: [], collected: [] };
  }

  const next = updatePlayer(room, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => !ranksToCollect.includes(c.rank)),
    chests: [...p.chests, ...ranksToCollect],
  }));

  const logs: GameLogItem[] = ranksToCollect.map((rank) =>
    makeLog(`**${player.name}** собрал сундук: **${rank}**`, "success")
  );

  return { room: next, logs, collected: ranksToCollect };
}
