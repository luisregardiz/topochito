import { sql } from "drizzle-orm";
import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { recetario } from "./_schema";

// Una familia = un código de acceso (también viaja en el enlace /join/<código>) y varios cuidadores (household_member).
export const household = recetario.table("household", {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text().notNull(),
  // HMAC del código normalizado: búsqueda directa sin recorrer familias.
  accessCodeLookup: text("access_code_lookup").notNull().unique(),
  // Código cifrado (AES-256-GCM): permite volver a mostrarlo para compartir el enlace.
  accessCodeEnc: text("access_code_enc").notNull(),
  // Zona horaria IANA de la familia: el día, la semana y las horas de comida se calculan en ella.
  timeZone: text("time_zone").notNull().default("America/Caracas"),
  // País (ISO 3166-1 alfa-2); por ahora solo se guarda (diccionario regional futuro).
  country: text(),
  // Hora de cada comida («HH:MM» en la zona de la familia); se valida con Zod (households.schemas.ts).
  mealTimes: jsonb("meal_times").$type<Record<string, string>>(),
  // Última visita; la purga por inactividad borra las familias que no vuelven en 30 días.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Cuidador con su propia sesión: la cookie lleva householdId + memberId. Revocarlo corta su acceso (se verifica en el servidor).
export const householdMember = recetario.table(
  "household_member",
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    label: text().notNull(), // «Mamá», «Abuela»…
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("household_member_household_idx").on(t.householdId)],
);

// Enlace de invitación: multiuso hasta que vence (7 días) o se revoca. Solo se guarda el SHA-256 del token.
export const householdInvite = recetario.table(
  "household_invite",
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("household_invite_household_idx").on(t.householdId)],
);
