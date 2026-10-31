import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, icsDate } from "./ics";

const NOW = new Date("2026-10-30T12:00:00Z");
const event = {
  uid: "meal-2026-10-30-almuerzo-abc@topochito",
  start: new Date("2026-10-30T16:00:00Z"),
  durationMinutes: 30,
  summary: "Hora del almuerzo: Puré de auyama, caraotas; y pollo",
  description: "Receta: https://topochito.com/recetas/A1",
  url: "https://topochito.com/recetas/A1",
};

describe("iCalendar", () => {
  it("escapa coma, punto y coma, barra invertida y saltos de línea", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
  });

  it("pliega a 75 octetos sin partir caracteres UTF-8, con continuación por espacio", () => {
    const long = `SUMMARY:${"ñ".repeat(60)}`; // 8 + 120 octetos
    const folded = foldLine(long);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(long);
    expect(folded).not.toContain("�");
  });

  it("estructura: CRLF, un VEVENT con horas UTC de 30 min y la alarma pedida", () => {
    const ics = buildCalendar({
      name: "topochito · Topo",
      timeZone: "America/Caracas",
      events: [event],
      alarmMinutes: 15,
      now: NOW,
    });
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n").filter((l) => /\n/.test(l))).toEqual([]); // ningún LF suelto
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(unfolded).toContain("X-WR-CALNAME:topochito · Topo");
    expect(unfolded).toContain("X-WR-TIMEZONE:America/Caracas");
    expect(unfolded).toContain("DTSTART:20261030T160000Z");
    expect(unfolded).toContain("DTEND:20261030T163000Z");
    expect(unfolded).toContain(
      "SUMMARY:Hora del almuerzo: Puré de auyama\\, caraotas\; y pollo",
    );
    expect(unfolded).toContain("URL:https://topochito.com/recetas/A1");
    expect(unfolded).toContain("BEGIN:VALARM\r\nACTION:DISPLAY");
    expect(unfolded).toContain("TRIGGER:-PT15M");
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("a la hora exacta usa PT0M y sin alarma no hay VALARM", () => {
    const at = (alarmMinutes: number | null) =>
      buildCalendar({
        name: "x",
        timeZone: "UTC",
        events: [event],
        alarmMinutes,
        now: NOW,
      });
    expect(at(0)).toContain("TRIGGER:PT0M");
    expect(at(null)).not.toContain("VALARM");
  });

  it("el UID no depende del momento de generación (los eventos se actualizan, no se duplican)", () => {
    const a = buildCalendar({
      name: "x",
      timeZone: "UTC",
      events: [event],
      alarmMinutes: 0,
      now: NOW,
    });
    const b = buildCalendar({
      name: "x",
      timeZone: "UTC",
      events: [{ ...event, summary: "otra receta" }],
      alarmMinutes: 0,
      now: new Date("2026-10-31T00:00:00Z"),
    });
    const uid = (s: string) => s.match(/UID:(.+)\r\n/)![1];
    expect(uid(a)).toBe(uid(b));
    expect(icsDate(NOW)).toBe("20261030T120000Z");
  });
});
