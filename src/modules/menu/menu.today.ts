import { addDays, zonedInstant } from "@/lib/zoned-time";
import type { MealTimes } from "@/modules/households/households.schemas";
import { mealsForAge } from "./menu.generator";
import type { MenuMeal, StoredEntry, Today } from "./menu.schemas";

// Fecha civil (YYYY-MM-DD) de un día de la semana (1 = lunes).
export const dateOfDay = (weekStart: string, day: number) =>
  addDays(weekStart, day - 1);

// Comidas de un día con su hora local y su instante exacto, ordenadas por hora.
// Un hueco sin receta (menú armado a mano) aparece con `recipe: null`.
export function dayPlan({
  entries,
  weekStart,
  day,
  ageMonths,
  timeZone,
  mealTimes,
}: {
  entries: StoredEntry[];
  weekStart: string;
  day: number;
  ageMonths: number;
  timeZone: string;
  mealTimes: MealTimes;
}) {
  const date = dateOfDay(weekStart, day);
  return mealsForAge(ageMonths)
    .map((meal: MenuMeal) => ({
      meal,
      time: mealTimes[meal],
      startsAt: zonedInstant(date, mealTimes[meal], timeZone).toISOString(),
      recipe:
        entries.find((e) => e.day === day && e.meal === meal)?.recipe ?? null,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function todayPlan({
  entries,
  week,
  ageMonths,
  timeZone,
  mealTimes,
}: {
  entries: StoredEntry[];
  week: { weekStart: string; today: number };
  ageMonths: number;
  timeZone: string;
  mealTimes: MealTimes;
}): Today {
  return {
    date: dateOfDay(week.weekStart, week.today),
    day: week.today,
    timeZone,
    meals: dayPlan({
      entries,
      weekStart: week.weekStart,
      day: week.today,
      ageMonths,
      timeZone,
      mealTimes,
    }),
  };
}
