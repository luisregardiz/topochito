import { describe, expect, it } from "vitest";
import type { AllergenStatus, BabyInput } from "./baby.schemas";
import { getBaby, saveBaby } from "./baby.service";

const now = new Date("2026-10-25T16:00:00Z");

const fakeRepo = () => {
  const saved: { id: string; baby: BabyInput }[] = [];
  return {
    saved,
    get: async (id: string) => {
      const s = saved.findLast((x) => x.id === id)?.baby;
      return s
        ? { ...s, allergens: s.allergens as Record<string, AllergenStatus> }
        : null;
    },
    allergenSlugs: async () => ["huevo", "mani", "lacteos"],
    save: async (id: string, baby: BabyInput) => void saved.push({ id, baby }),
  };
};
const valid: BabyInput = {
  birthMonth: 3,
  birthYear: 2026,
  allergens: { mani: "avoid", huevo: "introduced" },
};

describe("saveBaby", () => {
  it("guarda y devuelve el perfil con la edad calculada", async () => {
    const repo = fakeRepo();
    const result = await saveBaby(repo, "h1", valid, now);
    expect(result).toEqual({ ok: true, baby: { ...valid, ageMonths: 7 } });
    expect(repo.saved).toHaveLength(1);
  });

  it("rechaza fecha futura, demasiado mayor y alérgenos desconocidos sin guardar nada", async () => {
    const repo = fakeRepo();
    expect(
      await saveBaby(repo, "h1", { ...valid, birthMonth: 12 }, now),
    ).toEqual({ ok: false, reason: "future_date" });
    expect(
      await saveBaby(repo, "h1", { ...valid, birthYear: 2020 }, now),
    ).toEqual({ ok: false, reason: "too_old" });
    expect(
      await saveBaby(
        repo,
        "h1",
        { ...valid, allergens: { kiwi: "avoid" } },
        now,
      ),
    ).toEqual({
      ok: false,
      reason: "unknown_allergen",
    });
    expect(repo.saved).toHaveLength(0);
  });

  it("acepta un bebé de hoy (0 meses) y exactamente 36 meses", async () => {
    const repo = fakeRepo();
    expect(
      (
        await saveBaby(
          repo,
          "h1",
          { ...valid, birthMonth: 10, birthYear: 2026 },
          now,
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await saveBaby(
          repo,
          "h1",
          { ...valid, birthMonth: 10, birthYear: 2023 },
          now,
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await saveBaby(
          repo,
          "h1",
          { ...valid, birthMonth: 9, birthYear: 2023 },
          now,
        )
      ).ok,
    ).toBe(false);
  });
});

describe("getBaby", () => {
  it("sin perfil devuelve null; con perfil, la edad al día", async () => {
    const repo = fakeRepo();
    expect(await getBaby(repo, "h1", now)).toBeNull();
    await saveBaby(repo, "h1", valid, now);
    expect((await getBaby(repo, "h1", now))?.ageMonths).toBe(7);
    expect(
      (await getBaby(repo, "h1", new Date("2027-01-10T12:00:00Z")))?.ageMonths,
    ).toBe(10);
  });
});
