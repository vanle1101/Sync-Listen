import { Router, type IRouter } from "express";
import { db, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateRoomBody, GetRoomParams, GetRoomResponse } from "@workspace/api-zod";
import { getStreak } from "../lib/streakService";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genRoomId(): string {
  let id = "";
  for (let i = 0; i < 4; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)];
  return id;
}

const router: IRouter = Router();

router.post("/rooms", async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = genRoomId();
  const [room] = await db
    .insert(roomsTable)
    .values({ id, hostName: parsed.data.hostName, roomName: parsed.data.roomName })
    .returning();

  res.status(201).json(GetRoomResponse.parse({ ...room, createdAt: room.createdAt.toISOString() }));
});

router.get("/rooms/:roomId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const params = GetRoomParams.safeParse({ roomId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, params.data.roomId));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json(GetRoomResponse.parse({ ...room, createdAt: room.createdAt.toISOString() }));
});

router.get("/rooms/:roomId/streak", async (req, res): Promise<void> => {
  const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  if (!roomId) { res.status(400).json({ error: "Missing roomId" }); return; }
  const result = await getStreak(roomId);
  res.json(result);
});

export default router;
