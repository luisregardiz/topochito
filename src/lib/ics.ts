// Generador iCalendar (RFC 5545) mínimo para el feed de recordatorios.
// Horas en UTC («…Z»): válido según el RFC y cada calendario las muestra en la hora local del teléfono,
// así no hace falta un VTIMEZONE por zona (X-WR-TIMEZONE solo orienta a Google/Apple).

export type IcsEvent = {
  uid: string; // estable: regenerar el menú actualiza el evento en vez de duplicarlo
  start: Date;
  durationMinutes: number;
  summary: string;
  description?: string;
  url?: string;
};

const CRLF = "\r\n";

// TEXT: \\ , ; y saltos de línea se escapan (RFC 5545 §3.3.11).
export const escapeText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Pliega a 75 octetos (§3.1): la continuación empieza con un espacio, que cuenta en su línea.
// Nunca corta un carácter UTF-8 por la mitad.
export function foldLine(line: string) {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join(`${CRLF} `);
}

export const icsDate = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export function buildCalendar({
  name,
  timeZone,
  events,
  alarmMinutes,
  now,
}: {
  name: string;
  timeZone: string;
  events: IcsEvent[];
  alarmMinutes: number | null; // null = sin alarma
  now: Date;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//topochito//recordatorios//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${timeZone}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    const end = new Date(e.start.getTime() + e.durationMinutes * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (alarmMinutes !== null) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(e.summary)}`,
        `TRIGGER:${alarmMinutes === 0 ? "PT0M" : `-PT${alarmMinutes}M`}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
