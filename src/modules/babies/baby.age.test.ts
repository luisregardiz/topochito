import { describe, expect, it } from "vitest";
import { ageInMonths, currentYearMonth } from "./baby.age";

describe("ageInMonths", () => {
  const now = new Date("2026-10-25T16:00:00Z");

  it("cuenta meses de calendario", () => {
    expect(ageInMonths({ month: 3, year: 2026 }, now)).toBe(7);
    expect(ageInMonths({ month: 10, year: 2026 }, now)).toBe(0);
    expect(ageInMonths({ month: 11, year: 2025 }, now)).toBe(11);
    expect(ageInMonths({ month: 10, year: 2025 }, now)).toBe(12);
  });

  it("fecha futura da negativo", () => {
    expect(ageInMonths({ month: 12, year: 2026 }, now)).toBe(-2);
  });

  it("usa la hora de Caracas (UTC−4) para el cambio de mes", () => {
    // 1 nov 02:00 UTC = 31 oct 22:00 en Caracas: todavía es octubre.
    const lateOctober = new Date("2026-11-01T02:00:00Z");
    expect(currentYearMonth(lateOctober)).toEqual({ year: 2026, month: 10 });
    expect(ageInMonths({ month: 3, year: 2026 }, lateOctober)).toBe(7);
    // 1 nov 05:00 UTC = 1 nov 01:00 en Caracas: ya es noviembre.
    expect(
      ageInMonths({ month: 3, year: 2026 }, new Date("2026-11-01T05:00:00Z")),
    ).toBe(8);
  });
});
