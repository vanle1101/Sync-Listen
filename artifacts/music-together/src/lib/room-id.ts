export function normalizeRoomId(roomId: string | null | undefined): string {
  return (roomId ?? "").trim().toUpperCase();
}

export function extractNormalizedRoomId(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/^.*\/room\//i, "");
  return normalizeRoomId(normalized);
}
