import { describe, expect, it } from "vitest";
import { addDays, zonedInstant } from "./zoned-time";

describe("horas en la zona de la familia", () => {
  it("Caracas no tiene horario de verano: siempre UTC-4", () => {
    expect(
      zonedInstant("2026-01-15", "12:00", "America/Caracas").toISOString(),
    ).toBe("2026-01-15T16:00:00.000Z");
    expect(
      zonedInstant("2026-07-15", "12:00", "America/Caracas").toISOString(),
    ).toBe("2026-07-15T16:00:00.000Z");
  });

  it("Santiago cambia de hora: el mismo almuerzo cae en otro instante UTC antes y después", () => {
    // El horario de verano empieza el primer domingo de septiembre (6 sep 2026).
    expect(
      zonedInstant("2026-09-05", "12:00", "America/Santiago").toISOString(),
    ).toBe("2026-09-05T16:00:00.000Z");
    expect(
      zonedInstant("2026-09-07", "12:00", "America/Santiago").toISOString(),
    ).toBe("2026-09-07T15:00:00.000Z");
  });

  it("una hora que no existe por el salto de primavera se corre hacia adelante", () => {
    // 6 sep 2026: a las 00:00 pasa a 01:00; las 00:30 no existen.
    const t = zonedInstant("2026-09-06", "00:30", "America/Santiago");
    expect(t.toISOString()).toBe("2026-09-06T04:30:00.000Z");
  });

  it("suma días sobre el calendario civil, cruzando meses", () => {
    expect(addDays("2026-10-26", 6)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
