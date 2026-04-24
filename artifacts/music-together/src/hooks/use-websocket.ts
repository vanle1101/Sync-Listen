import { useEffect, useRef, useState, useCallback } from "react";
import { RoomState } from "../lib/types";
import { getWebSocketUrl } from "@/lib/runtime-config";

function getLatencyAdjustedTime(currentTime: unknown, playing: unknown, serverNow: unknown) {
  const safeCurrentTime = Number(currentTime);
  if (!Number.isFinite(safeCurrentTime) || safeCurrentTime < 0) return 0;
  if (!playing) return safeCurrentTime;
  const safeServerNow = Number(serverNow);
  if (!Number.isFinite(safeServerNow) || safeServerNow <= 0) return safeCurrentTime;
  const elapsedSec = Math.max(0, (Date.now() - safeServerNow) / 1000);
  return safeCurrentTime + elapsedSec;
}

export function useWebSocket(roomId: string, userName: string | null, avatarUrl?: string | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingActions = useRef<any[]>([]);
  const mountedRef = useRef(true);
  const roomIdRef = useRef(roomId);
  const userNameRef = useRef(userName);
  const avatarUrlRef = useRef(avatarUrl);

  roomIdRef.current = roomId;
  userNameRef.current = userName;
  avatarUrlRef.current = avatarUrl;

  const sendAction = useCallback((action: any) => {
    if (action?.type === "play_pause") {
      setRoomState(prev => {
        if (!prev) return prev;
        const requestedTime = Number(action.currentTime);
        return {
          ...prev,
          playing: typeof action.playing === "boolean" ? action.playing : prev.playing,
          currentTime: Number.isFinite(requestedTime) ? requestedTime : prev.currentTime,
        };
      });
    }

    if (action?.type === "seek") {
      setRoomState(prev => {
        if (!prev) return prev;
        const requestedTime = Number(action.currentTime);
        if (!Number.isFinite(requestedTime)) return prev;
        return {
          ...prev,
          currentTime: requestedTime,
        };
      });
    }

    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(action));
    } else {
      // Heartbeat/sync packets are ephemeral: drop while reconnecting to avoid stale rewinds.
      if (action?.type === "sync_time") return;
      // Keep only the latest play/pause while offline.
      if (action?.type === "play_pause") {
        pendingActions.current = pendingActions.current.filter(a => a?.type !== "play_pause");
      }
      pendingActions.current.push(action);
      console.warn("[WS] queued action (reconnecting):", action.type);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!roomId || !userName) return;

    const connect = () => {
      if (!mountedRef.current) return;

      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        setError(null);
        const joinMsg: any = { type: "join", roomId: roomIdRef.current, userName: userNameRef.current };
        if (avatarUrlRef.current) joinMsg.avatarUrl = avatarUrlRef.current;
        ws.send(JSON.stringify(joinMsg));

        while (pendingActions.current.length > 0) {
          const action = pendingActions.current.shift();
          ws.send(JSON.stringify(action));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "room_state":
              setRoomState({
                ...msg.room,
                currentTime: getLatencyAdjustedTime(msg.room?.currentTime, msg.room?.playing, msg.room?.serverNow),
              });
              break;
            case "chat":
              setRoomState(prev => prev ? {
                ...prev,
                chatHistory: [...prev.chatHistory, { userName: msg.userName, text: msg.text, timestamp: msg.timestamp }]
              } : null);
              break;
            case "playback":
              setRoomState(prev => prev ? {
                ...prev,
                playing: msg.playing,
                currentTime: getLatencyAdjustedTime(msg.currentTime, msg.playing, msg.serverNow),
                serverNow: Number.isFinite(Number(msg.serverNow)) ? Number(msg.serverNow) : prev.serverNow,
                currentTrack: msg.currentTrack !== undefined
                  ? msg.currentTrack
                  : (msg.videoId
                    ? (prev.currentTrack?.videoId === msg.videoId
                      ? prev.currentTrack
                      : prev.playlist.find((t: any) => t.videoId === msg.videoId) || prev.currentTrack)
                    : null)
              } : null);
              break;
            case "playlist_update":
              setRoomState(prev => prev ? {
                ...prev,
                playlist: msg.playlist,
                playedTracks: msg.playedTracks ?? prev.playedTracks ?? [],
              } : null);
              break;
            case "settings_update":
              setRoomState(prev => prev ? {
                ...prev,
                repeatMode: msg.repeatMode ?? prev.repeatMode,
                shuffle: msg.shuffle ?? prev.shuffle,
              } : null);
              break;
            case "democracy_update":
              setRoomState(prev => prev ? { ...prev, democracyMode: msg.democracyMode } : null);
              break;
            case "room_renamed":
              setRoomState(prev => prev ? { ...prev, roomName: msg.roomName as string } : null);
              break;
            case "room_closed":
              setRoomClosed(true);
              break;
            case "listeners_update":
              setRoomState(prev => {
                if (prev) {
                  return {
                    ...prev,
                    listeners: msg.listeners,
                    hostName: msg.hostName,
                    userAvatars: msg.userAvatars ?? prev.userAvatars ?? {},
                  };
                }
                // Allow listeners state to initialize before full room_state arrives,
                // preventing UI from requiring manual refresh after join.
                return {
                  roomId: roomIdRef.current,
                  hostName: (msg.hostName as string) ?? (userNameRef.current ?? ""),
                  roomName: "",
                  listeners: (msg.listeners as string[]) ?? [],
                  userAvatars: (msg.userAvatars as Record<string, string>) ?? {},
                  playlist: [],
                  playedTracks: [],
                  currentTrack: null,
                  playing: false,
                  currentTime: 0,
                  serverNow: Date.now(),
                  chatHistory: [],
                  repeatMode: "all",
                  shuffle: false,
                  democracyMode: false,
                };
              });
              break;
            case "error":
              setError(msg.message);
              break;
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        socketRef.current = null;
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        setError("Mất kết nối, đang thử lại...");
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      const ws = socketRef.current;
      if (ws) {
        ws.onclose = null;
        ws.close();
        socketRef.current = null;
      }
    };
  }, [roomId, userName]);

  return { roomState, connected, error, sendAction, roomClosed };
}
