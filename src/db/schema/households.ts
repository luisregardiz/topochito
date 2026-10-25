import { sql } from "drizzle-orm";
import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { recetario } from "./_schema";

// Una familia = un código de acceso (también viaja en el enlace /join/<código>). Futuro: `users` con FK a households.id (tabla nueva, sin tocar esta).
export const household = recetario.table("household", {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text().notNull(),
  // HMAC del código normalizado: búsqueda directa sin recorrer familias.
  accessCodeLookup: text("access_code_lookup").notNull().unique(),
  // Código cifrado (AES-256-GCM): permite volver a mostrarlo para compartir el enlace.
  accessCodeEnc: text("access_code_enc").notNull(),
  // Última visita; la purga por inactividad borra las familias que no vuelven en 30 días.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
