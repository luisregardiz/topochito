import { describe, expect, it } from "vitest";
import { weekOf } from "./menu.week";

describe("weekOf", () => {
  it("devuelve el lunes de la semana y el día de hoy", () => {
    expect(weekOf(new Date("2026-10-26T16:00:00Z"))).toEqual({
      weekStart: "2026-10-26",
      today: 1,
    }); // lunes
    expect(weekOf(new Date("2026-10-28T16:00:00Z"))).toEqual({
      weekStart: "2026-10-26",
      today: 3,
    }); // miércoles
    expect(weekOf(new Date("2026-11-01T16:00:00Z"))).toEqual({
      weekStart: "2026-10-26",
      today: 7,
    }); // domingo
  });

  it("usa la hora de Caracas: domingo de noche local ya es lunes en UTC", () => {
    // lunes 2 nov 01:00 UTC = domingo 1 nov 21:00 en Caracas
    expect(weekOf(new Date("2026-11-02T01:00:00Z"))).toEqual({
      weekStart: "2026-10-26",
      today: 7,
    });
    expect(weekOf(new Date("2026-11-02T04:30:00Z"))).toEqual({
      weekStart: "2026-11-02",
      today: 1,
    });
  });

  it("cruza el fin de año", () => {
    expect(weekOf(new Date("2027-01-01T16:00:00Z"))).toEqual({
      weekStart: "2026-12-28",
      today: 5,
    });
  });
});
