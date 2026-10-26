import { describe, expect, it } from "vitest";
import type { RecipeListItem } from "@/modules/recipes/recipes.schemas";
import type { Candidate } from "./menu.generator";
import type { EntryRef, MenuMeal, StoredEntry } from "./menu.schemas";
import {
  generateMenu,
  getMenu,
  regenerate,
  setEntries,
  type Deps,
} from "./menu.service";

const NOW = new Date("2026-10-28T16:00:00Z"); // miércoles 28 oct 2026 (semana del 26)

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG: Candidate[] = (
  ["desayuno", "almuerzo", "merienda", "cena"] as MenuMeal[]
).flatMap((meal) =>
  Array.from({ length: 8 }, (_, i) => ({
    code: `${meal[0]!.toUpperCase()}${i + 1}`,
    meal,
    isIron: i < 5,
    isFish: meal === "almuerzo" && i >= 6,
    isMaxOnce: meal === "almuerzo" && i === 5,
  })),
);

function fakeDeps(
  opts: {
    baby?: {
      birthMonth: number;
      birthYear: number;
      allergens: Record<string, "introduced" | "avoid">;
    } | null;
    seed?: number;
  } = {},
) {
  const rows = new Map<string, string>(); // "día:comida" → código
  const calls = {
    candidates: [] as { age: number; avoid: string[]; householdId: string }[],
  };
  const recipe = (code: string, meal: MenuMeal): RecipeListItem => ({
    code,
    title: `Receta ${code}`,
    mealType: meal,
    minAgeMonths: 7,
    isIronSource: CATALOG.find((c) => c.code === code)!.isIron,
    ironNote: null,
    thumbUrl: null,
    missingFoods: [],
    allergens: [],
  });
  const deps: Deps = {
    menu: {
      candidates: async (age, avoid, householdId) => (
        calls.candidates.push({ age, avoid, householdId }),
        CATALOG.filter((c) => c.meal !== "cena" || age >= 8)
      ),
      getWeek: async () =>
        [...rows].map(([k, code]) => {
          const [day, meal] = k.split(":");
          const c = CATALOG.find((x) => x.code === code)!;
          return {
            day: Number(day),
            meal: meal as MenuMeal,
            recipe: recipe(code, meal as MenuMeal),
            isFish: c.isFish,
            isMaxOnce: c.isMaxOnce,
          } satisfies StoredEntry;
        }),
      replaceWeek: async (_h, _w, entries) => {
        rows.clear();
        for (const e of entries) rows.set(`${e.day}:${e.meal}`, e.recipe);
      },
      setEntries: async (_h, _w, entries: EntryRef[]) =>
        void entries.forEach((e) => rows.set(`${e.day}:${e.meal}`, e.recipe)),
      recipeMeals: async (codes) =>
        new Map(
          codes.flatMap((c) =>
            CATALOG.some((x) => x.code === c)
              ? [[c, CATALOG.find((x) => x.code === c)!.meal] as const]
              : [],
          ),
        ),
    },
    baby: {
      get: async () =>
        opts.baby === undefined
          ? { birthMonth: 3, birthYear: 2026, allergens: { mani: "avoid" } }
          : opts.baby,
    },
    babyAge: (b, now) =>
      (now.getUTCFullYear() - b.birthYear) * 12 +
      (now.getUTCMonth() + 1 - b.birthMonth),
    now: () => NOW,
    random: seeded(opts.seed ?? 1),
  };
  return { deps, rows, calls };
}

describe("menú semanal", () => {
  it("sin perfil del bebé no se puede generar", async () => {
    const { deps } = fakeDeps({ baby: null });
    expect(await generateMenu(deps, "h1")).toEqual({
      ok: false,
      error: "baby_required",
    });
    expect(await getMenu(deps, "h1")).toEqual({ menu: null });
  });

  it("genera el menú con la edad y los alérgenos a evitar del perfil", async () => {
    const { deps, calls } = fakeDeps();
    const r = await generateMenu(deps, "h1");
    if (!r.ok) throw new Error(r.error);
    // 7 meses, sin cena; recibe la familia para aplicar su despensa
    expect(calls.candidates).toEqual([
      { age: 7, avoid: ["mani"], householdId: "h1" },
    ]);
    expect(r.menu.ageMonths).toBe(7);
    expect(r.menu.weekStart).toBe("2026-10-26");
    expect(r.menu.today).toBe(3);
    expect(r.menu.days).toHaveLength(7);
    expect(
      r.menu.days.every(
        (d) =>
          d.meals.map((m) => m.meal).join() === "desayuno,almuerzo,merienda",
      ),
    ).toBe(true);
    expect(r.menu.checks.map((c) => c.key)).toEqual(["iron", "fish", "liver"]);
  });

  it("a los 8 meses incluye la cena", async () => {
    const { deps } = fakeDeps({
      baby: { birthMonth: 2, birthYear: 2026, allergens: {} },
    });
    const r = await generateMenu(deps, "h1");
    if (!r.ok) throw new Error(r.error);
    expect(r.menu.ageMonths).toBe(8);
    expect(r.menu.days[0]!.meals.map((m) => m.meal)).toContain("cena");
  });

  it("getMenu devuelve el menú guardado de esta semana", async () => {
    const { deps } = fakeDeps();
    expect((await getMenu(deps, "h1")).menu).toBeNull();
    await generateMenu(deps, "h1");
    expect((await getMenu(deps, "h1")).menu?.days).toHaveLength(7);
  });

  it("cambiar una comida devuelve lo anterior para poder deshacer", async () => {
    const { deps, rows } = fakeDeps();
    await generateMenu(deps, "h1");
    const before = rows.get("2:almuerzo");
    const r = await regenerate(deps, "h1", {
      scope: "meal",
      day: 2,
      meal: "almuerzo",
    });
    if (!r.ok) throw new Error(r.error);
    expect(rows.get("2:almuerzo")).not.toBe(before);
    expect(r.previous).toEqual([{ day: 2, meal: "almuerzo", recipe: before }]);

    // deshacer = poner de vuelta lo anterior
    const undo = await setEntries(deps, "h1", { entries: r.previous });
    expect(undo.ok).toBe(true);
    expect(rows.get("2:almuerzo")).toBe(before);
  });

  it("cambiar un día solo toca ese día", async () => {
    const { deps, rows } = fakeDeps();
    await generateMenu(deps, "h1");
    const snapshot = new Map(rows);
    const r = await regenerate(deps, "h1", { scope: "day", day: 4 });
    if (!r.ok) throw new Error(r.error);
    for (const [k, code] of snapshot)
      if (!k.startsWith("4:")) expect(rows.get(k)).toBe(code);
    expect(r.previous.every((p) => p.day === 4)).toBe(true);
  });

  it("regenerar sin menú falla con no_menu", async () => {
    const { deps } = fakeDeps();
    expect(await regenerate(deps, "h1", { scope: "day", day: 1 })).toEqual({
      ok: false,
      error: "no_menu",
    });
  });

  it("se puede armar un menú a mano: los huecos vacíos cuentan como faltantes", async () => {
    const { deps, rows } = fakeDeps();
    const r = await setEntries(deps, "h1", {
      entries: [{ day: 1, meal: "desayuno", recipe: "D1" }],
    });
    if (!r.ok) throw new Error(r.error);
    expect(rows.size).toBe(1);
    expect(r.menu.meals).toContain("almuerzo");
    expect(r.menu.days[0]!.meals.map((m) => m.meal)).toEqual(["desayuno"]);
    const check = (key: string) => r.menu.checks.find((c) => c.key === key)!;
    expect(check("iron").ok).toBe(false);
    expect(check("fish").ok).toBe(false);
  });

  it("cambiar un día con huecos vacíos los llena, pero solo se deshace lo que ya tenía receta", async () => {
    const { deps } = fakeDeps();
    await setEntries(deps, "h1", {
      entries: [{ day: 2, meal: "desayuno", recipe: "D1" }],
    });
    const r = await regenerate(deps, "h1", { scope: "day", day: 2 });
    if (!r.ok) throw new Error(r.error);
    expect(r.menu.days[1]!.meals.length).toBe(r.menu.meals.length);
    expect(r.previous.every((p) => p.meal === "desayuno")).toBe(true);
  });

  it("valida que la receta sea de esa comida y que la comida exista a esa edad", async () => {
    const { deps } = fakeDeps();
    await generateMenu(deps, "h1");
    expect(
      await setEntries(deps, "h1", {
        entries: [{ day: 1, meal: "desayuno", recipe: "A1" }],
      }),
    ).toEqual({ ok: false, error: "invalid_recipe" });
    expect(
      await setEntries(deps, "h1", {
        entries: [{ day: 1, meal: "desayuno", recipe: "Z9" }],
      }),
    ).toEqual({ ok: false, error: "invalid_recipe" });
    expect(
      await setEntries(deps, "h1", {
        entries: [{ day: 1, meal: "cena", recipe: "C1" }],
      }),
    ).toEqual({ ok: false, error: "invalid_slot" });
    const ok = await setEntries(deps, "h1", {
      entries: [{ day: 1, meal: "desayuno", recipe: "d3" }],
    });
    expect(ok.ok).toBe(true);
  });

  it("cambiar una comida que no está en el menú es invalid_slot", async () => {
    const { deps } = fakeDeps();
    await generateMenu(deps, "h1");
    expect(
      await regenerate(deps, "h1", { scope: "meal", day: 1, meal: "cena" }),
    ).toEqual({ ok: false, error: "invalid_slot" });
  });
});
