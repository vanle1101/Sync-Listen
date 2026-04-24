import { WebSocket } from "ws";

export interface Track {
  videoId: string;
  source?: "youtube" | "soundcloud" | "upload";
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string | null;
  mediaUrl?: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface ChatMessage {
  userName: string;
  text: string;
  timestamp: string;
}

export type RepeatMode = 'none' | 'one' | 'all';

export interface RoomState {
  roomId: string;
  hostName: string;
  roomName: string;
  listeners: string[];
  userAvatars: Record<string, string>;
  playlist: Track[];
  playedTracks: Track[];
  currentTrack: Track | null;
  playing: boolean;
  currentTime: number;
  playbackUpdatedAt: number;
  chatHistory: ChatMessage[];
  repeatMode: RepeatMode;
  shuffle: boolean;
  democracyMode: boolean;
}

interface ListenerInfo {
  ws: WebSocket;
  userName: string;
}

const rooms = new Map<string, RoomState>();
const roomListeners = new Map<string, ListenerInfo[]>();

export function getOrCreateRoomState(roomId: string, hostName: string, roomName = ""): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      hostName,
      roomName,
      listeners: [],
      userAvatars: {},
      playlist: [],
      playedTracks: [],
      currentTrack: null,
      playing: false,
      currentTime: 0,
      playbackUpdatedAt: Date.now(),
      chatHistory: [],
      repeatMode: 'all',
      shuffle: false,
      democracyMode: false,
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

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
  roomListeners.delete(roomId);
}

export function sendToSocket(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function getEffectiveCurrentTime(room: RoomState, nowMs = Date.now()): number {
  if (!room.playing || !room.currentTrack) return Math.max(0, room.currentTime || 0);
  const deltaSec = Math.max(0, (nowMs - room.playbackUpdatedAt) / 1000);
  return Math.max(0, (room.currentTime || 0) + deltaSec);
}

export function updatePlaybackAnchor(
  room: RoomState,
  next: { currentTime?: number; playing?: boolean } = {},
): void {
  const now = Date.now();
  const effectiveNow = getEffectiveCurrentTime(room, now);
  room.currentTime = Number.isFinite(next.currentTime as number)
    ? Math.max(0, next.currentTime as number)
    : effectiveNow;
  if (typeof next.playing === "boolean") {
    room.playing = next.playing;
  }
  room.playbackUpdatedAt = now;
}

export function buildPlaybackPayload(room: RoomState) {
  const now = Date.now();
  return {
    type: "playback",
    playing: room.playing,
    currentTime: getEffectiveCurrentTime(room, now),
    videoId: room.currentTrack?.videoId ?? null,
    currentTrack: room.currentTrack ?? null,
    serverNow: now,
  };
}

export function buildRoomStateForClient(room: RoomState): RoomState & { serverNow: number } {
  const now = Date.now();
  return {
    ...room,
    currentTime: getEffectiveCurrentTime(room, now),
    serverNow: now,
  };
}

/** Pick next track respecting shuffle. Returns undefined if no more tracks. */
export function pickNextTrack(room: RoomState): Track | undefined {
  if (room.playlist.length === 0) return undefined;
  if (room.shuffle) {
    const idx = Math.floor(Math.random() * room.playlist.length);
    const [track] = room.playlist.splice(idx, 1);
    return track;
  }
  return room.playlist.shift();
}
