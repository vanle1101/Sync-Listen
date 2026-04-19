import { pgTable, text, date, primaryKey } from "drizzle-orm/pg-core";

export const roomSessionsTable = pgTable(
  "room_sessions",
  {
    roomId: text("room_id").notNull(),
    sessionDate: date("session_date").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.sessionDate] })]
);

export type RoomSession = typeof roomSessionsTable.$inferSelect;
