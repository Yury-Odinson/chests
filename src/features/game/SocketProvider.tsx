"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/shared/types/events";
import type {
  ClientGameState,
  GameLogItem,
  RoomSummary,
} from "@/shared/types/game";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SessionInfo {
  roomId: string;
  playerId: string;
}

const STORAGE_KEY = "chests:session";
const NAME_KEY = "chests:name";

function readName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeName(name: string): void {
  if (typeof window === "undefined") return;
  if (!name) {
    window.localStorage.removeItem(NAME_KEY);
    return;
  }
  window.localStorage.setItem(NAME_KEY, name);
}

function readSession(): SessionInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionInfo) : null;
  } catch {
    return null;
  }
}

function writeSession(info: SessionInfo | null): void {
  if (typeof window === "undefined") return;
  if (!info) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

interface SocketContextValue {
  socket: GameSocket | null;
  connected: boolean;
  state: ClientGameState | null;
  error: string | null;
  recentLogs: GameLogItem[];
  session: SessionInfo | null;
  setSession: (info: SessionInfo | null) => void;
  clearRoomState: () => void;
  kicked: boolean;
  clearKicked: () => void;
  roomClosed: boolean;
  clearRoomClosed: () => void;
  clearError: () => void;
  name: string;
  setName: (name: string) => void;
  hydrated: boolean;
  rooms: RoomSummary[];
  online: number;
  enterLobby: () => void;
  leaveLobby: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<GameLogItem[]>([]);
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [kicked, setKicked] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [name, setNameState] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [online, setOnline] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSessionState(readSession());
    setNameState(readName());
    setHydrated(true);
  }, []);

  const setSession = useCallback((info: SessionInfo | null) => {
    writeSession(info);
    setSessionState(info);
  }, []);

  const setName = useCallback((next: string) => {
    writeName(next);
    setNameState(next);
  }, []);

  const clearRoomState = useCallback(() => {
    setState(null);
    setRecentLogs([]);
  }, []);

  const enterLobby = useCallback(() => {
    socketRef.current?.emit("lobby:join");
  }, []);

  const leaveLobby = useCallback(() => {
    socketRef.current?.emit("lobby:leave");
  }, []);

  useEffect(() => {
    const s: GameSocket = io({
      path: "/api/socket",
      autoConnect: true,
    });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      const saved = readSession();
      if (saved) {
        s.emit("room:rejoin", {
          roomId: saved.roomId,
          playerId: saved.playerId,
        });
      }
    });
    s.on("disconnect", () => setConnected(false));
    s.on("game:state", (next) => {
      setState(next);
      if (next.status === "finished") {
        // keep session, but don't auto-clear
      }
    });
    s.on("game:log", (item) => {
      setRecentLogs((prev) => [...prev.slice(-20), item]);
    });
    s.on("game:error", ({ message }) => {
      setError(message);
    });
    s.on("room:created", ({ roomId, playerId }) => {
      setSession({ roomId, playerId });
    });
    s.on("room:joined", ({ roomId, playerId }) => {
      setSession({ roomId, playerId });
    });
    s.on("room:list", ({ rooms: next }) => {
      setRooms(next);
    });
    s.on("presence", ({ online: next }) => {
      setOnline(next);
    });
    s.on("session:invalid", () => {
      // Stale auto-rejoin: the room no longer exists. Forget it silently
      // instead of surfacing an error or hanging on "looking for room…".
      setSession(null);
      clearRoomState();
    });
    s.on("room:closed", () => {
      setSession(null);
      clearRoomState();
      setRoomClosed(true);
    });
    s.on("room:kicked", () => {
      // Host removed us from the lobby — drop the session and clear state so
      // the game page bounces back to the lobby.
      setSession(null);
      clearRoomState();
      setKicked(true);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [clearRoomState, setSession]);

  const clearError = useCallback(() => setError(null), []);
  const clearKicked = useCallback(() => setKicked(false), []);
  const clearRoomClosed = useCallback(() => setRoomClosed(false), []);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketRef.current,
      connected,
      state,
      error,
      recentLogs,
      session,
      setSession,
      clearRoomState,
      kicked,
      clearKicked,
      roomClosed,
      clearRoomClosed,
      clearError,
      name,
      setName,
      hydrated,
      rooms,
      online,
      enterLobby,
      leaveLobby,
    }),
    [
      connected,
      state,
      error,
      recentLogs,
      session,
      setSession,
      clearRoomState,
      kicked,
      clearKicked,
      roomClosed,
      clearRoomClosed,
      clearError,
      name,
      setName,
      hydrated,
      rooms,
      online,
      enterLobby,
      leaveLobby,
    ]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useGameSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useGameSocket must be used inside SocketProvider");
  return ctx;
}
