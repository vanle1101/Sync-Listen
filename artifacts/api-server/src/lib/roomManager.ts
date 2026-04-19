import { WebSocket } from "ws";

export interface Track {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string | null;
}

export interface ChatMessage {
  userName: string;
  text: string;
  timestamp: string;
}

export interface RoomState {
  roomId: string;
  hostName: string;
  listeners: string[];
  playlist: Track[];
  currentTrack: Track | null;
  playing: boolean;
  currentTime: number;
  chatHistory: ChatMessage[];
}

interface ListenerInfo {
  ws: WebSocket;
  userName: string;
}

const rooms = new Map<string, RoomState>();
const roomListeners = new Map<string, ListenerInfo[]>();

export function getOrCreateRoomState(roomId: string, hostName: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      hostName,
      listeners: [],
      playlist: [],
      currentTrack: null,
      playing: false,
      currentTime: 0,
      chatHistory: [],
    });
  }
  return rooms.get(roomId)!;
}

export function getRoomState(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

export function addListener(roomId: string, ws: WebSocket, userName: string): void {
  if (!roomListeners.has(roomId)) {
    roomListeners.set(roomId, []);
  }
  const list = roomListeners.get(roomId)!;
  const existing = list.find((l) => l.userName === userName);
  if (!existing) {
    list.push({ ws, userName });
  } else {
    existing.ws = ws;
  }

  const room = rooms.get(roomId);
  if (room && !room.listeners.includes(userName)) {
    room.listeners.push(userName);
  }
}

export function removeListener(roomId: string, ws: WebSocket): string | null {
  const list = roomListeners.get(roomId);
  if (!list) return null;

  const idx = list.findIndex((l) => l.ws === ws);
  if (idx === -1) return null;

  const [removed] = list.splice(idx, 1);
  const room = rooms.get(roomId);
  if (room) {
    room.listeners = room.listeners.filter((n) => n !== removed.userName);
  }
  return removed.userName;
}

export function broadcast(roomId: string, message: object, exclude?: WebSocket): void {
  const list = roomListeners.get(roomId) ?? [];
  const payload = JSON.stringify(message);
  for (const listener of list) {
    if (listener.ws !== exclude && listener.ws.readyState === WebSocket.OPEN) {
      listener.ws.send(payload);
    }
  }
}

export function sendToSocket(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
