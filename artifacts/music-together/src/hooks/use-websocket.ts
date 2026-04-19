import { useEffect, useRef, useState, useCallback } from "react";
import { RoomState, Track } from "../lib/types";

export function useWebSocket(roomId: string, userName: string | null) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!roomId || !userName) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: "join", roomId, userName }));
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
                : (msg.videoId ? (prev.currentTrack?.videoId === msg.videoId ? prev.currentTrack : prev.playlist.find((t: any) => t.videoId === msg.videoId) || prev.currentTrack) : null)
            } : null);
            break;
            
          case "playlist_update":
            setRoomState(prev => prev ? { ...prev, playlist: msg.playlist } : null);
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
      setConnected(false);
      setSocket(null);
      // Try to reconnect after 3s
      setTimeout(connect, 3000);
    };
    
    ws.onerror = () => {
      setError("WebSocket connection error");
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, [roomId, userName]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
    };
  }, [connect]);

  const sendAction = useCallback((action: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(action));
    }
  }, [socket]);

  return {
    roomState,
    connected,
    error,
    sendAction
  };
}
