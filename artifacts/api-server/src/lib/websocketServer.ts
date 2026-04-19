import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import {
  getOrCreateRoomState,
  getRoomState,
  addListener,
  removeListener,
  broadcast,
  sendToSocket,
  pickNextTrack,
  type Track,
} from "./roomManager";
import { logger } from "./logger";

function broadcastPlayback(roomId: string, room: ReturnType<typeof getRoomState>) {
  if (!room) return;
  broadcast(roomId, {
    type: "playback",
    playing: room.playing,
    currentTime: room.currentTime,
    videoId: room.currentTrack?.videoId ?? null,
    currentTrack: room.currentTrack ?? null,
  });
}

function broadcastFullState(roomId: string, room: ReturnType<typeof getRoomState>) {
  if (!room) return;
  broadcast(roomId, { type: "playlist_update", playlist: room.playlist, playedTracks: room.playedTracks });
  broadcastPlayback(roomId, room);
}

export function setupWebSocketServer(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let currentUserName: string | null = null;

    ws.on("message", (raw) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendToSocket(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (msg.type === "join") {
        const roomId = msg.roomId as string;
        const userName = msg.userName as string;
        if (!roomId || !userName) {
          sendToSocket(ws, { type: "error", message: "Missing roomId or userName" });
          return;
        }
        currentRoomId = roomId;
        currentUserName = userName;
        const room = getOrCreateRoomState(roomId, userName);
        // Store avatar URL (only https:// URLs for security, not base64)
        const avatarUrl = msg.avatarUrl as string | undefined;
        if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('https://')) {
          room.userAvatars[userName] = avatarUrl.substring(0, 512);
        }
        addListener(roomId, ws, userName);
        sendToSocket(ws, { type: "room_state", room });
        broadcast(roomId, { type: "listeners_update", listeners: room.listeners, hostName: room.hostName, userAvatars: room.userAvatars }, ws);
        logger.info({ roomId, userName }, "User joined room");
        return;
      }

      if (!currentRoomId || !currentUserName) {
        sendToSocket(ws, { type: "error", message: "Not joined a room yet" });
        return;
      }

      const room = getRoomState(currentRoomId);
      if (!room) {
        sendToSocket(ws, { type: "error", message: "Room not found" });
        return;
      }

      const isHost = currentUserName === room.hostName;
      const canControl = isHost || room.democracyMode;

      switch (msg.type) {
        case "chat": {
          const text = msg.text as string;
          if (!text) break;
          const chatMsg = { userName: currentUserName, text, timestamp: new Date().toISOString() };
          room.chatHistory.push(chatMsg);
          if (room.chatHistory.length > 100) room.chatHistory.shift();
          broadcast(currentRoomId, { type: "chat", ...chatMsg });
          break;
        }

        case "add_track": {
          if (!canControl) { sendToSocket(ws, { type: "error", message: "Only host" }); break; }
          const track = msg.track as Track;
          if (!track?.videoId) break;
          logger.info({ roomId: currentRoomId, trackId: track.videoId }, "Track added to queue");
          room.playlist.push(track);
          broadcast(currentRoomId, { type: "playlist_update", playlist: room.playlist, playedTracks: room.playedTracks });
          break;
        }

        case "play_track": {
          if (!canControl) { sendToSocket(ws, { type: "error", message: "Only host" }); break; }
          const index = typeof msg.index === "number" ? msg.index : 0;
          if (index < 0 || index >= room.playlist.length) break;
          if (room.currentTrack) room.playedTracks.push(room.currentTrack);
          room.currentTrack = room.playlist[index];
          room.playlist.splice(index, 1);
          room.playing = true;
          room.currentTime = 0;
          logger.info({ roomId: currentRoomId, trackId: room.currentTrack.videoId }, "Host started track");
          broadcastFullState(currentRoomId, room);
          break;
        }

        case "remove_track": {
          if (!canControl) { sendToSocket(ws, { type: "error", message: "Only host" }); break; }
          const index = msg.index as number;
          if (typeof index !== "number" || index < 0 || index >= room.playlist.length) break;
          room.playlist.splice(index, 1);
          broadcast(currentRoomId, { type: "playlist_update", playlist: room.playlist, playedTracks: room.playedTracks });
          break;
        }

        case "play_pause": {
          if (!canControl) { sendToSocket(ws, { type: "error", message: "Only host" }); break; }
          if (!room.currentTrack && room.playlist.length > 0) {
            if (room.currentTrack) room.playedTracks.push(room.currentTrack);
            room.currentTrack = pickNextTrack(room)!;
            room.playing = true;
            room.currentTime = 0;
            broadcast(currentRoomId, { type: "playlist_update", playlist: room.playlist, playedTracks: room.playedTracks });
          } else {
            room.playing = msg.playing as boolean;
            room.currentTime = (msg.currentTime as number) ?? room.currentTime;
          }
          broadcastPlayback(currentRoomId, room);
          break;
        }

        case "skip": {
          if (!canControl) { sendToSocket(ws, { type: "error", message: "Only host" }); break; }

          if (room.repeatMode === 'one') {
            // Replay same track
            room.currentTime = 0;
            room.playing = true;
            broadcastPlayback(currentRoomId, room);
            break;
          }

          // Push current to played history
          if (room.currentTrack) {
            room.playedTracks.push(room.currentTrack);
          }

          if (room.playlist.length > 0) {
            room.currentTrack = pickNextTrack(room)!;
          } else if (room.repeatMode === 'all' && room.playedTracks.length > 0) {
            // Refill queue from history
            if (room.shuffle) {
              // shuffle the history back in
              const all = [...room.playedTracks];
              for (let i = all.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [all[i], all[j]] = [all[j], all[i]];
              }
              room.playlist = all;
            } else {
              room.playlist = [...room.playedTracks];
            }
            room.playedTracks = [];
            room.currentTrack = room.playlist.shift()!;
          } else {
            room.currentTrack = null;
            room.playing = false;
          }

          room.currentTime = 0;
          if (room.currentTrack) room.playing = true;
          logger.info({ roomId: currentRoomId, next: room.currentTrack?.videoId ?? 'none' }, "Skipped to next track");
          broadcastFullState(currentRoomId, room);
          break;
        }

        case "prev_track": {
          if (!canControl) { sendToSocket(ws, { type: "error", message: "Only host" }); break; }
          // If currently playing > 3s, restart current
          if ((room.currentTime ?? 0) > 3 && room.currentTrack) {
            room.currentTime = 0;
            room.playing = true;
            broadcastPlayback(currentRoomId, room);
            break;
          }
          // Go to previous
          if (room.currentTrack) room.playlist.unshift(room.currentTrack);
          if (room.playedTracks.length > 0) {
            room.currentTrack = room.playedTracks.pop()!;
          } else {
            room.currentTrack = room.playlist.length > 0 ? room.playlist.shift()! : null;
          }
          room.currentTime = 0;
          room.playing = room.currentTrack !== null;
          broadcastFullState(currentRoomId, room);
          break;
        }

        case "set_repeat": {
          if (!canControl) break;
          const modes = ['none', 'one', 'all'] as const;
          const cur = modes.indexOf(room.repeatMode);
          room.repeatMode = modes[(cur + 1) % 3];
          broadcast(currentRoomId, { type: "settings_update", repeatMode: room.repeatMode, shuffle: room.shuffle });
          break;
        }

        case "set_shuffle": {
          if (!canControl) break;
          room.shuffle = !room.shuffle;
          broadcast(currentRoomId, { type: "settings_update", repeatMode: room.repeatMode, shuffle: room.shuffle });
          break;
        }

        case "seek": {
          if (!canControl) break;
          room.currentTime = (msg.currentTime as number) ?? 0;
          broadcast(currentRoomId, {
            type: "playback",
            playing: room.playing,
            currentTime: room.currentTime,
            videoId: room.currentTrack?.videoId ?? null,
            currentTrack: room.currentTrack ?? null,
          }, ws);
          break;
        }

        case "set_democracy": {
          if (!isHost) { sendToSocket(ws, { type: "error", message: "Only host" }); break; }
          room.democracyMode = !room.democracyMode;
          broadcast(currentRoomId, { type: "democracy_update", democracyMode: room.democracyMode });
          logger.info({ roomId: currentRoomId, democracyMode: room.democracyMode }, "Democracy mode toggled");
          break;
        }

        default:
          sendToSocket(ws, { type: "error", message: `Unknown message type: ${msg.type}` });
      }
    });

    ws.on("close", () => {
      if (!currentRoomId) return;
      const userName = removeListener(currentRoomId, ws);
      if (userName) {
        const room = getRoomState(currentRoomId);
        if (room) {
          broadcast(currentRoomId, { type: "listeners_update", listeners: room.listeners, hostName: room.hostName, userAvatars: room.userAvatars });
          logger.info({ roomId: currentRoomId, userName }, "User left room");
        }
      }
    });

    ws.on("error", (err) => { logger.error({ err }, "WebSocket error"); });
  });

  logger.info("WebSocket server set up at /ws");
}
