import { useEffect, useRef, useState, useCallback } from "react";
import { RoomState } from "../lib/types";

export function useWebSocket(roomId: string, userName: string | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingActions = useRef<any[]>([]);
  const mountedRef = useRef(true);
  const roomIdRef = useRef(roomId);
  const userNameRef = useRef(userName);

  roomIdRef.current = roomId;
  userNameRef.current = userName;

  const sendAction = useCallback((action: any) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(action));
    } else {
      pendingActions.current.push(action);
      console.warn("[WS] queued action (reconnecting):", action.type);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!roomId || !userName) return;

    const connect = () => {
      if (!mountedRef.current) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        setError(null);
        ws.send(JSON.stringify({ type: "join", roomId: roomIdRef.current, userName: userNameRef.current }));

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
              setRoomState(msg.room);
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
                currentTime: msg.currentTime,
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
            case "listeners_update":
              setRoomState(prev => prev ? { ...prev, listeners: msg.listeners, hostName: msg.hostName } : null);
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

  return { roomState, connected, error, sendAction };
}
