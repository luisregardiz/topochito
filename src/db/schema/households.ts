import { sql } from "drizzle-orm";
import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { recetario } from "./_schema";

// Una familia = un código de acceso. Futuro: `users` con FK a households.id (tabla nueva, sin tocar esta).
export const household = recetario.table("household", {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text().notNull(),
  accessCodeHash: text("access_code_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
