import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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
  // Feed de calendario (.ics): un token por familia, solo su SHA-256. null = sin feed.
  calendarTokenHash: text("calendar_token_hash").unique(),
  // Aviso del calendario: 0 = a la hora de la comida, 15 = quince minutos antes.
  calendarAlarmMinutes: smallint("calendar_alarm_minutes").notNull().default(0),
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
    // Anticipación de sus avisos push: 0 o 15 minutos.
    pushLeadMinutes: smallint("push_lead_minutes").notNull().default(0),
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

// Suscripción web push de un cuidador (un registro por navegador/dispositivo).
export const pushSubscription = recetario.table(
  "push_subscription",
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMember.id, { onDelete: "cascade" }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (t) => [index("push_subscription_member_idx").on(t.memberId)],
);

// Avisos ya enviados: la clave única hace idempotente el cron aunque corra dos veces.
export const reminderDelivery = recetario.table(
  "reminder_delivery",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMember.id, { onDelete: "cascade" }),
    reminderKey: text("reminder_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.reminderKey] })],
);
