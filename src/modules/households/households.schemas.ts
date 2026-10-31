import { z } from "zod";
import { MENU_MEALS, type MenuMeal } from "@/modules/menu/menu.schemas";

export const accessInput = z.object({
  code: z.string().min(1).max(64),
  label: z.string().trim().max(40).optional(),
});

const familyName = z.string().trim().min(1).max(80);
export const createHouseholdInput = z.object({ name: familyName });

export const purgeQuery = z.object({ dryRun: z.enum(["0", "1"]).default("0") });

// --- Ajustes de la familia ---------------------------------------------------

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "formato HH:MM");
export const mealTimesInput = z.object(
  Object.fromEntries(MENU_MEALS.map((m) => [m, hhmm])) as Record<
    MenuMeal,
    typeof hhmm
  >,
);
export type MealTimes = z.infer<typeof mealTimesInput>;
export const DEFAULT_MEAL_TIMES: MealTimes = {
  desayuno: "07:30",
  almuerzo: "12:00",
  merienda: "15:30",
  cena: "18:30",
};

// Zona IANA («America/Caracas»): la que el runtime reconoce, con forma Área/Ciudad (o UTC).
export function isTimeZone(tz: string) {
  if (tz !== "UTC" && !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/.test(tz))
    return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
export const timeZoneInput = z
  .string()
  .max(64)
  .refine(isTimeZone, "zona horaria desconocida");

// Por ahora solo se guarda: base del futuro diccionario regional.
export const COUNTRIES = {
  VE: "Venezuela",
  AR: "Argentina",
  BO: "Bolivia",
  CL: "Chile",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  EC: "Ecuador",
  SV: "El Salvador",
  ES: "España",
  US: "Estados Unidos",
  GT: "Guatemala",
  HN: "Honduras",
  MX: "México",
  NI: "Nicaragua",
  PA: "Panamá",
  PY: "Paraguay",
  PE: "Perú",
  PR: "Puerto Rico",
  DO: "República Dominicana",
  UY: "Uruguay",
} as const;
export type Country = keyof typeof COUNTRIES;
const country = z
  .enum(Object.keys(COUNTRIES) as [Country, ...Country[]])
  .nullable(); // null = otro país

export const settingsInput = z.object({
  timeZone: timeZoneInput,
  country,
  mealTimes: mealTimesInput,
});
export type SettingsInput = z.infer<typeof settingsInput>;
export type HouseholdSettings = SettingsInput & { name: string };

// --- Crear familia (/empezar) ------------------------------------------------

const slug = z.string().regex(/^[a-z0-9_-]{1,40}$/);
export const onboardingInput = settingsInput.extend({
  name: familyName,
  label: z.string().trim().max(40).optional(), // cómo aparece quien la crea en la lista de cuidadores
  website: z.literal("").optional(), // honeypot: una persona nunca lo ve ni lo llena
  baby: z.object({
    nickname: z.string().trim().max(30).optional(),
    birthMonth: z.number().int().min(1).max(12),
    birthYear: z.number().int().min(2000).max(2100),
    introduced: z.array(slug).max(20), // alérgenos que ya come
  }),
});
export type OnboardingInput = z.infer<typeof onboardingInput>;
