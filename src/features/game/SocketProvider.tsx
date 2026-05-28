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
import type { ClientGameState, GameLogItem } from "@/shared/types/game";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SessionInfo {
  roomId: string;
  playerId: string;
}

const STORAGE_KEY = "chests:session";

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
  clearError: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<GameLogItem[]>([]);
  const [session, setSessionState] = useState<SessionInfo | null>(null);

  useEffect(() => {
    setSessionState(readSession());
  }, []);

  const setSession = useCallback((info: SessionInfo | null) => {
    writeSession(info);
    setSessionState(info);
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

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [setSession]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketRef.current,
      connected,
      state,
      error,
      recentLogs,
      session,
      setSession,
      clearError,
    }),
    [connected, state, error, recentLogs, session, setSession, clearError]
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
