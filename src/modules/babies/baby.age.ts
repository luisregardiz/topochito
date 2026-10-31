// Zona por defecto (familias anteriores a la zona por familia). El menú, «Hoy» y los recordatorios usan household.time_zone.
// shortcut: la edad en meses se calcula en esta zona; solo difiere unas horas el día 1 de cada mes.
export const APP_TIME_ZONE = "America/Caracas";

export function currentYearMonth(now: Date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

// Meses cumplidos por calendario (marzo 2026 → octubre 2026 = 7).
export function ageInMonths(birth: { month: number; year: number }, now: Date) {
  const c = currentYearMonth(now);
  return c.year * 12 + c.month - (birth.year * 12 + birth.month);
}
