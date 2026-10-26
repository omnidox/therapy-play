import { useCallback, useEffect, useRef, useState } from "react";
import { forgetRoom, readKey, removeKey, saveKey } from "./storage";
import type {
  BoardData,
  ClientMessage,
  ErrorReason,
  GameView,
  TrayView,
  RoomState,
  ServerMessage,
} from "@therapy-play/shared";

export type JoinParams = { hostKey?: string; token?: string; names?: string[] };

export type RoomView = {
  role: "host" | "child" | null;
  state: RoomState | null;
  mine: number[]; // player ids on this screen
  game: GameView | null;
  tray: TrayView | null; // the sandtray's figures
  board: BoardData | null; // the full board; the host only
  ended: boolean;
  error: ErrorReason | null; // the room could not be joined (or this seat was removed)
  notice: ErrorReason | null; // a short-lived message about the last action
  reconnecting: boolean; // the connection dropped and we are trying again
  send: (msg: ClientMessage) => void;
};

const RETRY_MS = [1000, 2000, 4000, 8000]; // then every 8 seconds
const PING_EVERY_MS = 15_000;
const SILENT_LIMIT_MS = 40_000; // no word from the server for this long: treat it as dropped

// A screen keeps its seat, even if the browser is closed, with a private token on this device.
export function readSeat(code: string): string | undefined {
  return readKey(`seat:${code}`);
}

function saveSeat(code: string, token: string | null) {
  if (token === null) removeKey(`seat:${code}`);
  else saveKey(`seat:${code}`, token);
}

// Keeps one WebSocket to the room (once `join` is set) and the latest room state.
// If the connection drops (a phone sleeps, Wi-Fi blips) it reconnects by itself
// and takes the same seat back.
export function useRoom(code: string, join: JoinParams | null): RoomView {
  const [role, setRole] = useState<RoomView["role"]>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [mine, setMine] = useState<number[]>([]);
  const [game, setGame] = useState<GameView | null>(null);
  const [tray, setTray] = useState<TrayView | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<ErrorReason | null>(null);
  const [notice, setNotice] = useState<ErrorReason | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (join === null) return;
    let stopped = false; // set on cleanup, or when the room is over for good
    let joinedOnce = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let current: WebSocket | null = null;
    let seatToken = join.token; // this tab's own seat, kept in memory for reconnects
    let lastHeard = Date.now(); // when the server last sent us anything

    const lost = (socket: WebSocket) => {
      if (stopped || current !== socket) return; // ignore sockets we already gave up on
      current = null;
      wsRef.current = null;
      setReconnecting(true);
      retryTimer = setTimeout(connect, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]);
      attempt++;
    };

    const connect = () => {
      if (stopped) return;
      clearTimeout(retryTimer);
      const scheme = location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${scheme}://${location.host}/ws`);
      current = socket;
      wsRef.current = socket;
      let confirmed = false; // the server has accepted the join on this connection
      lastHeard = Date.now();
      let pinger: ReturnType<typeof setInterval> | undefined;

      socket.onopen = () => {
        if (current !== socket) return;
        // After the first join, take the seat back with the private token.
        const params = joinedOnce && seatToken ? { token: seatToken } : join;
        const msg: ClientMessage = { type: "join", code, ...params };
        socket.send(JSON.stringify(msg));
        pinger = setInterval(() => {
          if (current !== socket) return clearInterval(pinger);
          if (Date.now() - lastHeard > SILENT_LIMIT_MS) {
            socket.close();
            clearInterval(pinger);
            lost(socket);
          } else if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
          }
        }, PING_EVERY_MS);
      };

      socket.onmessage = (e) => {
        if (current !== socket) return;
        lastHeard = Date.now();
        const msg = JSON.parse(e.data) as ServerMessage;
        if (msg.type === "joined") {
          confirmed = true;
          joinedOnce = true;
          attempt = 0;
          setError(null);
          setReconnecting(false);
          setRole(msg.role);
          if (msg.token) {
            seatToken = msg.token;
            saveSeat(code, msg.token);
          }
        } else if (msg.type === "room") {
          setState(msg.state);
          setMine(msg.mine);
        } else if (msg.type === "game") setGame(msg.game);
        else if (msg.type === "tray") setTray(msg.tray);
        else if (msg.type === "board") setBoard(msg.board);
        else if (msg.type === "ended") {
          stopped = true;
          forgetRoom(code);
          setEnded(true);
        } else if (msg.type === "error") {
          if (msg.reason === "seat_gone") saveSeat(code, null);
          if (!confirmed || msg.reason === "seat_gone") {
            // The room refused us (or our seat was closed): retrying would not help.
            stopped = true;
            if (msg.reason === "not_found") forgetRoom(code);
            setReconnecting(false);
            setError(msg.reason);
          } else {
            setNotice(msg.reason);
            clearTimeout(noticeTimer.current);
            noticeTimer.current = setTimeout(() => setNotice(null), 5000);
          }
        }
      };

      socket.onclose = () => {
        clearInterval(pinger);
        lost(socket);
      };
    };

    // A phone that wakes up should not wait for the next retry.
    const wake = () => {
      const socket = current;
      if (stopped) return;
      if (document.visibilityState === "hidden") return;
      if (socket === null) {
        attempt = 0;
        connect();
      } else if (socket.readyState === WebSocket.OPEN) {
        // The connection may have died while the phone slept: ask, and give it a few seconds.
        const asked = Date.now();
        socket.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
        setTimeout(() => {
          if (current === socket && lastHeard < asked) {
            socket.close();
            lost(socket);
          }
        }, 5000);
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(noticeTimer.current);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      current?.close();
      current = null;
      wsRef.current = null;
    };
  }, [code, join]);

  const send = useCallback((msg: ClientMessage) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }, []);

  return { role, state, mine, game, tray, board, ended, error, notice, reconnecting, send };
}
