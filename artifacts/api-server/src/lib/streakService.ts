import { db, roomSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/** Record that roomId had ≥2 listeners today (idempotent). */
export async function recordSession(roomId: string): Promise<void> {
  const date = todayDateString();
  try {
    await db
      .insert(roomSessionsTable)
      .values({ roomId, sessionDate: date })
      .onConflictDoNothing();
  } catch {
    // ignore duplicate
  }
}

/** Calculate streak (consecutive days) for a room. */
export async function getStreak(roomId: string): Promise<{ streak: number; lastDate: string | null }> {
  const rows = await db
    .select({ sessionDate: roomSessionsTable.sessionDate })
    .from(roomSessionsTable)
    .where(eq(roomSessionsTable.roomId, roomId))
    .orderBy(desc(roomSessionsTable.sessionDate));

  if (rows.length === 0) return { streak: 0, lastDate: null };

  const dates = rows.map((r) => r.sessionDate); // already "YYYY-MM-DD" strings
  const today = todayDateString();

  // Start counting from today or yesterday
  let cursor = new Date(dates[0]);
  const todayDate = new Date(today);
  const diff = Math.round((todayDate.getTime() - cursor.getTime()) / 86400000);
  if (diff > 1) return { streak: 0, lastDate: dates[0] }; // gap > 1 day → broken

  let streak = 0;
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const expected = new Date(cursor);
    expected.setDate(cursor.getDate() - (i > 0 ? 1 : 0));
    if (i === 0) {
      streak = 1;
      cursor = d;
    } else {
      const prevDay = new Date(cursor);
      prevDay.setDate(prevDay.getDate() - 1);
      if (dates[i] === prevDay.toISOString().slice(0, 10)) {
        streak++;
        cursor = d;
      } else {
        break;
      }
    }
  }

  return { streak, lastDate: dates[0] };
}
