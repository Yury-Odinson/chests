import type { GameRoom } from "@/shared/types/game";

const rooms = new Map<string, GameRoom>();

export const roomsStore = {
  get(roomId: string): GameRoom | undefined {
    return rooms.get(roomId);
  },
  set(room: GameRoom): void {
    rooms.set(room.id, room);
  },
  delete(roomId: string): void {
    rooms.delete(roomId);
  },
  findBySocketId(socketId: string): GameRoom | undefined {
    for (const room of rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) {
        return room;
      }
    }
    return undefined;
  },
  all(): GameRoom[] {
    return [...rooms.values()];
  },
  /**
   * Remove rooms with no connected players that are older than `maxAgeMs`.
   * Safety net for rooms that somehow outlived their players. Returns the
   * number of rooms removed.
   */
  sweep(maxAgeMs: number, now: number = Date.now()): number {
    let removed = 0;
    for (const room of rooms.values()) {
      const empty = room.players.every((p) => !p.connected);
      const stale = now - new Date(room.createdAt).getTime() > maxAgeMs;
      if (empty && stale) {
        rooms.delete(room.id);
        removed += 1;
      }
    }
    return removed;
  },
};
