// Fechas del menú en español, sin Intl (el texto no depende del navegador ni de la zona horaria).
const DAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export const DAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
export const dayName = (day: number) => DAYS[day - 1]!;

// `weekStart` es el lunes (YYYY-MM-DD); `day` va de 1 (lunes) a 7.
function dayDate(weekStart: string, day: number) {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d;
}

export const dayNumber = (weekStart: string, day: number) =>
  dayDate(weekStart, day).getUTCDate();

export function formatDayLong(weekStart: string, day: number) {
  const d = dayDate(weekStart, day);
  const name = dayName(day);
  return `${name[0]!.toUpperCase()}${name.slice(1)} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

export function formatRange(weekStart: string) {
  const a = dayDate(weekStart, 1);
  const b = dayDate(weekStart, 7);
  return `${a.getUTCDate()} ${SHORT[a.getUTCMonth()]} – ${b.getUTCDate()} ${SHORT[b.getUTCMonth()]}`;
}
