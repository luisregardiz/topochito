import type { MealTimes } from "@/modules/households/households.schemas";
import { dateOfDay, dayPlan } from "@/modules/menu/menu.today";
import type { MenuMeal, StoredEntry } from "@/modules/menu/menu.schemas";

// Un recordatorio: algo que pasa a una hora concreta en la vida del bebé.
// `key` es estable por familia (p. ej. «meal:2026-10-30:almuerzo»): con ella el .ics da UIDs fijos
// y el push no repite un aviso. Los canales (feed .ics y push) solo consumen eventos, nunca menús.
export type ReminderEvent = {
  key: string;
  title: string;
  startsAt: Date;
  url: string; // ruta dentro de la app (cada canal la hace absoluta)
};

// Una fuente produce los eventos de una familia en un rango. Hoy: comidas del plan.
// Para sumar otra (p. ej. suplementos): una función más con esta firma en REMINDER_SOURCES (reminders.deps.ts).
export type ReminderSource = (
  householdId: string,
  range: { from: Date; to: Date },
) => Promise<ReminderEvent[]>;

export async function collectReminders(
  sources: ReminderSource[],
  householdId: string,
  range: { from: Date; to: Date },
) {
  const all = (
    await Promise.all(sources.map((s) => s(householdId, range)))
  ).flat();
  return all.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

const MEAL_TITLE: Record<MenuMeal, string> = {
  desayuno: "Hora del desayuno",
  almuerzo: "Hora del almuerzo",
  merienda: "Hora de la merienda",
  cena: "Hora de la cena",
};

// Núcleo puro de la fuente de comidas: semanas guardadas → eventos dentro del rango.
export function mealEvents({
  weeks,
  ageMonths,
  timeZone,
  mealTimes,
  from,
  to,
}: {
  weeks: { weekStart: string; entries: StoredEntry[] }[];
  ageMonths: number;
  timeZone: string;
  mealTimes: MealTimes;
  from: Date;
  to: Date;
}): ReminderEvent[] {
  return weeks.flatMap(({ weekStart, entries }) =>
    [1, 2, 3, 4, 5, 6, 7].flatMap((day) =>
      dayPlan({ entries, weekStart, day, ageMonths, timeZone, mealTimes })
        .filter((m) => m.recipe)
        .map((m) => ({
          key: `meal:${dateOfDay(weekStart, day)}:${m.meal}`,
          title: `${MEAL_TITLE[m.meal]}: ${m.recipe!.title}`,
          startsAt: new Date(m.startsAt),
          url: `/recetas/${m.recipe!.code}`,
        }))
        .filter((e) => e.startsAt >= from && e.startsAt < to),
    ),
  );
}
