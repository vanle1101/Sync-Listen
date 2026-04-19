import { pgTable, text, date, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const roomStreakFreezesTable = pgTable(
  "room_streak_freezes",
  {
    roomId: text("room_id").notNull(),
    frozenDate: date("frozen_date").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.frozenDate] })]
);

export type RoomStreakFreeze = typeof roomStreakFreezesTable.$inferSelect;
