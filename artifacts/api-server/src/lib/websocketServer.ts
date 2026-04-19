import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import {
  getOrCreateRoomState,
  getRoomState,
  addListener,
  removeListener,
  broadcast,
  sendToSocket,
  type Track,
} from "./roomManager";
import { logger } from "./logger";

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
        addListener(roomId, ws, userName);

        sendToSocket(ws, { type: "room_state", room });

        broadcast(
          roomId,
          {
            type: "listeners_update",
            listeners: room.listeners,
            hostName: room.hostName,
          },
          ws,
        );

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

      switch (msg.type) {
        case "chat": {
          const text = msg.text as string;
          if (!text) break;
          const chatMsg = {
            userName: currentUserName,
            text,
            timestamp: new Date().toISOString(),
          };
          room.chatHistory.push(chatMsg);
          if (room.chatHistory.length > 100) room.chatHistory.shift();
          broadcast(currentRoomId, { type: "chat", ...chatMsg });
          break;
        }

        case "add_track": {
          const track = msg.track as Track;
          if (!track?.videoId) break;
          room.playlist.push(track);
          if (!room.currentTrack) {
            room.currentTrack = room.playlist[0];
            room.playlist.shift();
          }
          broadcast(currentRoomId, { type: "playlist_update", playlist: room.playlist });
          if (room.currentTrack) {
            broadcast(currentRoomId, {
              type: "playback",
              playing: room.playing,
              currentTime: room.currentTime,
              videoId: room.currentTrack.videoId,
            });
          }
          break;
        }

        case "remove_track": {
          const index = msg.index as number;
          if (typeof index !== "number" || index < 0 || index >= room.playlist.length) break;
          room.playlist.splice(index, 1);
          broadcast(currentRoomId, { type: "playlist_update", playlist: room.playlist });
          break;
        }

        case "play_pause": {
          if (!isHost) {
            sendToSocket(ws, { type: "error", message: "Only the host can control playback" });
            break;
          }
          room.playing = msg.playing as boolean;
          room.currentTime = (msg.currentTime as number) ?? room.currentTime;
          broadcast(currentRoomId, {
            type: "playback",
            playing: room.playing,
            currentTime: room.currentTime,
            videoId: room.currentTrack?.videoId ?? null,
          });
          break;
        }

        case "skip": {
          if (!isHost) {
            sendToSocket(ws, { type: "error", message: "Only the host can skip" });
            break;
          }
          if (room.playlist.length > 0) {
            room.currentTrack = room.playlist.shift()!;
          } else {
            room.currentTrack = null;
          }
          room.playing = false;
          room.currentTime = 0;
          broadcast(currentRoomId, {
            type: "playback",
            playing: false,
            currentTime: 0,
            videoId: room.currentTrack?.videoId ?? null,
          });
          broadcast(currentRoomId, { type: "playlist_update", playlist: room.playlist });
          break;
        }

        case "seek": {
          if (!isHost) break;
          room.currentTime = (msg.currentTime as number) ?? 0;
          broadcast(
            currentRoomId,
            {
              type: "playback",
              playing: room.playing,
              currentTime: room.currentTime,
              videoId: room.currentTrack?.videoId ?? null,
            },
            ws,
          );
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
          broadcast(currentRoomId, {
            type: "listeners_update",
            listeners: room.listeners,
            hostName: room.hostName,
          });
          logger.info({ roomId: currentRoomId, userName }, "User left room");
        }
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  logger.info("WebSocket server set up at /ws");
}
