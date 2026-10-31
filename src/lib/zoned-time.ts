import { TZDate } from "@date-fns/tz";

// Fechas como «YYYY-MM-DD» (día civil de la familia) y horas como «HH:MM» en su zona horaria.

export function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Instante exacto de «ese día a esa hora» en la zona dada; respeta el horario de verano.
// Si la hora no existe ese día (salto de primavera), TZDate la corre hacia adelante.
export function zonedInstant(ymd: string, hhmm: string, timeZone: string) {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, timeZone).getTime());
}
