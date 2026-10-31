import { sql } from "drizzle-orm";
import {
  check,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { recetario } from "./_schema";
import { allergen } from "./catalog";
import { household } from "./households";

// Perfil mínimo del bebé (sin nombre completo ni datos sensibles; apodo opcional): un bebé por familia.
export const babyProfile = recetario.table(
  "baby_profile",
  {
    householdId: uuid("household_id")
      .primaryKey()
      .references(() => household.id, { onDelete: "cascade" }),
    birthMonth: smallint("birth_month").notNull(),
    birthYear: smallint("birth_year").notNull(),
    nickname: text(), // apodo opcional, solo para la interfaz
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("baby_profile_month_check", sql`${t.birthMonth} BETWEEN 1 AND 12`),
    check("baby_profile_year_check", sql`${t.birthYear} BETWEEN 2000 AND 2100`),
  ],
);

// «No introducido» no tiene fila: solo se guardan los alérgenos que ya come o que debe evitar.
export const allergenStatus = recetario.enum("allergen_status", [
  "introduced",
  "avoid",
]);

export const babyAllergen = recetario.table(
  "baby_allergen",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    allergenId: smallint("allergen_id")
      .notNull()
      .references(() => allergen.id),
    status: allergenStatus().notNull(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.allergenId] })],
);
