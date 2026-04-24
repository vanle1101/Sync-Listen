import { Router, type IRouter } from "express";
import { db, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateRoomBody, GetRoomParams, GetRoomResponse } from "@workspace/api-zod";
import { getStreak } from "../lib/streakService";
import { normalizeRoomId } from "../lib/roomId";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genRoomId(): string {
  let id = "";
  for (let i = 0; i < 4; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)];
  return id;
}

const router: IRouter = Router();
type MemoryRoom = { id: string; hostName: string; roomName: string; createdAt: Date };
const memoryRooms = new Map<string, MemoryRoom>();

router.post("/rooms", async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = genRoomId();
  let room: MemoryRoom;
  try {
    const [dbRoom] = await db
      .insert(roomsTable)
      .values({ id, hostName: parsed.data.hostName, roomName: parsed.data.roomName })
      .returning();
    room = {
      id: dbRoom.id,
      hostName: dbRoom.hostName,
      roomName: dbRoom.roomName ?? "",
      createdAt: dbRoom.createdAt,
    };
  } catch (err) {
    req.log.warn({ err }, "DB unavailable, using in-memory room store");
    room = {
      id,
      hostName: parsed.data.hostName,
      roomName: parsed.data.roomName ?? "",
      createdAt: new Date(),
    };
    memoryRooms.set(id, room);
  }

  res.status(201).json(GetRoomResponse.parse({ ...room, createdAt: room.createdAt.toISOString() }));
});

router.get("/rooms/:roomId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const params = GetRoomParams.safeParse({ roomId: normalizeRoomId(rawId) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let room:
    | { id: string; hostName: string; roomName: string; createdAt: Date }
    | undefined;
  try {
    const [dbRoom] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, params.data.roomId));
    room = dbRoom as typeof room;
  } catch (err) {
    req.log.warn({ err }, "DB unavailable, reading room from in-memory store");
    room = memoryRooms.get(params.data.roomId);
  }

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json(GetRoomResponse.parse({ ...room, createdAt: room.createdAt.toISOString() }));
});

router.delete("/rooms/:roomId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  if (!rawId) { res.status(400).json({ error: "Missing roomId" }); return; }
  const roomId = normalizeRoomId(rawId);
  try {
    await db.delete(roomsTable).where(eq(roomsTable.id, roomId));
  } catch (err) {
    req.log.warn({ err }, "DB unavailable, deleting room from in-memory store");
    memoryRooms.delete(roomId);
  }
  res.status(204).send();
});

router.get("/rooms/:roomId/streak", async (req, res): Promise<void> => {
  const roomId = normalizeRoomId(Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId);
  if (!roomId) { res.status(400).json({ error: "Missing roomId" }); return; }
  try {
    const result = await getStreak(roomId);
    res.json(result);
  } catch (err) {
    req.log.warn({ err }, "Streak service unavailable, returning zero streak");
    res.json({ streak: 0, freezesAvailable: 0, freezesUsed: 0 });
  }
});

export default router;
