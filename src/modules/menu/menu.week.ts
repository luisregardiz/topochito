import { APP_TIME_ZONE } from "@/modules/babies/baby.age";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Lunes de la semana de `now` (YYYY-MM-DD) y día de hoy (1 = lunes), en la zona horaria de la app.
export function weekOf(now: Date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const today = WEEKDAYS.indexOf(get("weekday")) + 1;
  const monday = new Date(
    Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))),
  );
  monday.setUTCDate(monday.getUTCDate() - (today - 1));
  return { weekStart: monday.toISOString().slice(0, 10), today };
}
