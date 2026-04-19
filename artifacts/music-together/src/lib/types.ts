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
