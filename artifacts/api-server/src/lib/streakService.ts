import { db, roomSessionsTable, roomStreakFreezesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid DST weirdness
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(later: string, earlier: string): number {
  const a = new Date(later + "T12:00:00Z");
  const b = new Date(earlier + "T12:00:00Z");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/**
 * Max freeze slots earned based on streak milestone:
 * <50 → 0, ≥50 → 1, ≥100 → 2, ≥200 → 3, ≥250 → 4, ≥300 → 5, …
 * (after 200, +1 per 50 days)
 */
export function getMaxFreezes(streak: number): number {
  if (streak < 50) return 0;
  if (streak < 100) return 1;
  if (streak < 200) return 2;
  return 3 + Math.floor((streak - 200) / 50);
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

export interface StreakResult {
  streak: number;
  lastDate: string | null;
  maxFreezes: number;
  freezesUsed: number;
  freezesAvailable: number;
}

/**
 * Calculate streak (consecutive days) for a room.
 * Auto-applies freeze when a 1-day gap is found and a freeze slot is available.
 * Freeze slots are determined by the streak length at the point of the gap.
 */
export async function getStreak(roomId: string): Promise<StreakResult> {
  const [sessionRows, freezeRows] = await Promise.all([
    db
      .select({ sessionDate: roomSessionsTable.sessionDate })
      .from(roomSessionsTable)
      .where(eq(roomSessionsTable.roomId, roomId))
      .orderBy(desc(roomSessionsTable.sessionDate)),
    db
      .select({ frozenDate: roomStreakFreezesTable.frozenDate })
      .from(roomStreakFreezesTable)
      .where(eq(roomStreakFreezesTable.roomId, roomId)),
  ]);

  const empty: StreakResult = { streak: 0, lastDate: null, maxFreezes: 0, freezesUsed: 0, freezesAvailable: 0 };

  if (sessionRows.length === 0) return empty;

  const sessionDates = new Set(sessionRows.map((r) => r.sessionDate));
  const frozenDates = new Set(freezeRows.map((r) => r.frozenDate));

  // All "active" dates = sessions + already-frozen dates
  const allDates = new Set<string>([...sessionDates, ...frozenDates]);

  const today = todayDateString();
  const mostRecentSession = sessionRows[0].sessionDate;

  // If the most recent session is more than 1 day ago, the streak is broken
  // (we only auto-freeze a 1-day gap within the streak, not between today and last session)
  if (diffDays(today, mostRecentSession) > 1) {
    return { streak: 0, lastDate: mostRecentSession, maxFreezes: 0, freezesUsed: frozenDates.size, freezesAvailable: 0 };
  }

  // Walk backwards from mostRecentSession, auto-applying freezes on 1-day gaps
  const newlyFrozen: string[] = [];
  let streak = 1;
  let prev = mostRecentSession;

  while (true) {
    const expectedPrev = addDays(prev, -1);

    if (allDates.has(expectedPrev)) {
      // Normal consecutive day — continue
      streak++;
      prev = expectedPrev;
      continue;
    }

    // Check for exactly a 1-day gap (expectedPrev missing, but the day before that exists)
    const dayBeforeGap = addDays(prev, -2);
    if (allDates.has(dayBeforeGap)) {
      // 1-day gap found. Check if a freeze is available.
      const totalUsed = frozenDates.size + newlyFrozen.length;
      const maxNow = getMaxFreezes(streak); // streak so far before this gap

      if (totalUsed < maxNow && !frozenDates.has(expectedPrev) && !newlyFrozen.includes(expectedPrev)) {
        // Auto-apply freeze: bridge the gap
        newlyFrozen.push(expectedPrev);
        allDates.add(expectedPrev);
        // Count the frozen day + the session on dayBeforeGap
        streak += 2;
        prev = dayBeforeGap;
        continue;
      }
    }

    // No consecutive day and no freeze applicable — stop
    break;
  }

  // Persist any newly applied freezes
  for (const fd of newlyFrozen) {
    frozenDates.add(fd);
    await db
      .insert(roomStreakFreezesTable)
      .values({ roomId, frozenDate: fd })
      .onConflictDoNothing();
  }

  const maxFreezesNow = getMaxFreezes(streak);
  const freezesUsed = frozenDates.size;
  const freezesAvailable = Math.max(0, maxFreezesNow - freezesUsed);

  return {
    streak,
    lastDate: mostRecentSession,
    maxFreezes: maxFreezesNow,
    freezesUsed,
    freezesAvailable,
  };
}
