import { describe, expect, it } from "vitest";
import { dayName, dayNumber, formatDayLong, formatRange } from "./menu.dates";

describe("fechas del menú", () => {
  it("rango de la semana", () => {
    expect(formatRange("2026-10-26")).toBe("26 oct – 1 nov");
    expect(formatRange("2026-12-28")).toBe("28 dic – 3 ene"); // cruza el año
  });

  it("día en texto largo", () => {
    expect(formatDayLong("2026-10-26", 1)).toBe("Lunes 26 de octubre");
    expect(formatDayLong("2026-10-26", 7)).toBe("Domingo 1 de noviembre");
    expect(formatDayLong("2026-10-26", 3)).toBe("Miércoles 28 de octubre");
  });

  it("nombre y número del día", () => {
    expect(dayName(2)).toBe("martes");
    expect(dayNumber("2026-10-26", 6)).toBe(31);
  });
});
