import "server-only";
import { babyRepository } from "@/modules/babies/baby.repository";
import { toProfile } from "@/modules/babies/baby.service";
import { householdsRepository } from "@/modules/households/households.repository";
import { menuRepository } from "@/modules/menu/menu.repository";
import { weekOf } from "@/modules/menu/menu.week";
import { addDays } from "@/lib/zoned-time";
import { mealEvents, type ReminderSource } from "./reminders.source";

// Fuente «comidas del plan»: lee las semanas guardadas que tocan el rango (hoy solo se guarda la actual).
export const mealSource: ReminderSource = async (householdId, { from, to }) => {
  const [settings, baby] = await Promise.all([
    householdsRepository.settings(householdId),
    babyRepository.get(householdId),
  ]);
  if (!settings || !baby) return [];
  const first = weekOf(from, settings.timeZone).weekStart;
  const last = weekOf(to, settings.timeZone).weekStart;
  const starts: string[] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) starts.push(w);
  const weeks = await Promise.all(
    starts.map(async (weekStart) => ({
      weekStart,
      entries: await menuRepository.getWeek(householdId, weekStart),
    })),
  );
  return mealEvents({
    weeks,
    ageMonths: toProfile(baby, from).ageMonths,
    timeZone: settings.timeZone,
    mealTimes: settings.mealTimes,
    from,
    to,
  });
};

// Todas las fuentes de recordatorios. Una fuente nueva (p. ej. suplementos) se agrega aquí y llega sola al .ics y al push.
export const REMINDER_SOURCES: ReminderSource[] = [mealSource];
