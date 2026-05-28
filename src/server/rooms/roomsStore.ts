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
};
