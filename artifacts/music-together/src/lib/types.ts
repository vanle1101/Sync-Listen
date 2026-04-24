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
  serverNow?: number;
  chatHistory: ChatMessage[];
  repeatMode: RepeatMode;
  shuffle: boolean;
  democracyMode: boolean;
}
