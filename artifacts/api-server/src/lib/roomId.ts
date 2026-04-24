export function normalizeRoomId(roomId: string | null | undefined): string {
  return (roomId ?? "").trim().toUpperCase();
}
