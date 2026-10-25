import { describe, expect, it } from "vitest";
import {
  DAYS,
  generateWeek,
  mealsForAge,
  regenerateDay,
  regenerateMeal,
  slotKey,
  type Candidate,
  type Ctx,
  type Plan,
  type Pools,
} from "./menu.generator";
import { summarize } from "./menu.summary";
import type { MenuMeal } from "./menu.schemas";

// PRNG con semilla para que cada prueba sea reproducible.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const c = (
  code: string,
  meal: MenuMeal,
  o: Partial<Candidate> = {},
): Candidate => ({
  code,
  meal,
  isIron: false,
  isFish: false,
  isMaxOnce: false,
  ...o,
});
const many = (prefix: string, meal: MenuMeal, n: number, iron: number) =>
  Array.from({ length: n }, (_, i) =>
    c(`${prefix}${i + 1}`, meal, { isIron: i < iron }),
  );

// Proporciones del dataset real para un bebé de 7 meses (sin cena): pocos desayunos y meriendas con hierro.
const POOLS_7: Pools = {
  desayuno: many("D", "desayuno", 13, 4),
  almuerzo: [
    ...many("A", "almuerzo", 10, 10),
    c("A11", "almuerzo", { isIron: true, isMaxOnce: true }), // hígado
    c("A12", "almuerzo", { isFish: true }),
    c("A13", "almuerzo", { isFish: true }),
    c("A14", "almuerzo", { isFish: true }),
  ],
  merienda: many("M", "merienda", 11, 2),
  cena: [],
};
const POOLS_9: Pools = {
  ...POOLS_7,
  cena: [
    ...many("C", "cena", 14, 11),
    c("C15", "cena", { isFish: true, isIron: true }),
  ],
};

const ctx = (pools: Pools, age: number, seed: number): Ctx => ({
  pools,
  meals: mealsForAge(age),
  random: seeded(seed),
});
const index = (pools: Pools) =>
  new Map(
    Object.values(pools)
      .flat()
      .map((x) => [x.code, x]),
  );
const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

describe("mealsForAge", () => {
  it("la cena aparece desde los 8 meses", () => {
    expect(mealsForAge(7)).toEqual(["desayuno", "almuerzo", "merienda"]);
    expect(mealsForAge(8)).toEqual([
      "desayuno",
      "almuerzo",
      "merienda",
      "cena",
    ]);
  });
});

describe("generateWeek", () => {
  it("llena los 7 días con recetas de la comida correcta (50 semillas)", () => {
    for (const seed of SEEDS) {
      const plan = generateWeek(ctx(POOLS_9, 9, seed))!;
      expect(Object.keys(plan)).toHaveLength(7 * 4);
      for (const day of DAYS) {
        for (const meal of mealsForAge(9)) {
          expect(
            POOLS_9[meal].some((x) => x.code === plan[slotKey(day, meal)]),
          ).toBe(true);
        }
      }
    }
  });

  it("pescado 2 veces por semana en días distintos y no seguidos; hígado como mucho 1", () => {
    for (const seed of SEEDS) {
      const plan = generateWeek(ctx(POOLS_7, 7, seed))!;
      const by = index(POOLS_7);
      const fishDays = DAYS.filter((d) =>
        mealsForAge(7).some((m) => by.get(plan[slotKey(d, m)]!)?.isFish),
      );
      expect(fishDays).toHaveLength(2);
      expect(Math.abs(fishDays[0]! - fishDays[1]!)).toBeGreaterThanOrEqual(2);
      const liver = Object.values(plan).filter(
        (code) => by.get(code)?.isMaxOnce,
      ).length;
      expect(liver).toBeLessThanOrEqual(1);
    }
  });

  it("con cena (8+ meses) todos los días llegan a 2 comidas con hierro", () => {
    for (const seed of SEEDS) {
      const plan = generateWeek(ctx(POOLS_9, 9, seed))!;
      const checks = summarize(plan, index(POOLS_9), mealsForAge(9));
      expect(checks.find((x) => x.key === "iron")!.ok).toBe(true);
    }
  });

  it("a los 7 meses (3 comidas, pocas recetas con hierro) logra el máximo posible", () => {
    // Hay 4 desayunos y 2 meriendas con hierro para 7 días: se pueden cumplir los 7 repitiendo alguna receta.
    for (const seed of SEEDS) {
      const plan = generateWeek(ctx(POOLS_7, 7, seed))!;
      const iron = summarize(plan, index(POOLS_7), mealsForAge(7)).find(
        (x) => x.key === "iron",
      )!;
      expect(iron.ok, `semilla ${seed}: ${iron.detail}`).toBe(true);
    }
  });

  it("es reproducible con la misma semilla y distinto con otra", () => {
    const a = generateWeek(ctx(POOLS_9, 9, 7));
    expect(generateWeek(ctx(POOLS_9, 9, 7))).toEqual(a);
    expect(generateWeek(ctx(POOLS_9, 9, 8))).not.toEqual(a);
  });

  it("sin recetas para alguna comida no genera menú", () => {
    expect(generateWeek(ctx({ ...POOLS_7, merienda: [] }, 7, 1))).toBeNull();
    expect(generateWeek(ctx(POOLS_7, 9, 1))).toBeNull(); // 9 meses exige cena y no hay
  });

  it("sin candidatas de pescado, genera igual sin pescado", () => {
    const noFish: Pools = {
      ...POOLS_7,
      almuerzo: POOLS_7.almuerzo.filter((x) => !x.isFish),
    };
    const plan = generateWeek(ctx(noFish, 7, 3))!;
    expect(Object.keys(plan)).toHaveLength(21);
    expect(
      summarize(plan, index(noFish), mealsForAge(7)).find(
        (x) => x.key === "fish",
      )!.short,
    ).toBe("0 veces");
  });

  it("prefiere no repetir recetas cuando hay suficientes", () => {
    const plan = generateWeek(ctx(POOLS_9, 9, 11))!;
    const lunches = DAYS.map((d) => plan[slotKey(d, "almuerzo")]);
    expect(new Set(lunches).size).toBeGreaterThanOrEqual(6);
  });
});

describe("regenerateMeal", () => {
  it("cambia por una receta distinta de la misma comida respetando los topes", () => {
    for (const seed of SEEDS) {
      const base = ctx(POOLS_9, 9, seed);
      const plan = generateWeek(base)!;
      const { plan: next, changed } = regenerateMeal(
        { ...base, random: seeded(seed + 100) },
        plan,
        3,
        "almuerzo",
      );
      expect(changed).toBe(true);
      expect(next[slotKey(3, "almuerzo")]).not.toBe(
        plan[slotKey(3, "almuerzo")],
      );
      const by = index(POOLS_9);
      const all = Object.values(next).map((code) => by.get(code)!);
      expect(all.filter((x) => x.isFish).length).toBeLessThanOrEqual(2);
      expect(all.filter((x) => x.isMaxOnce).length).toBeLessThanOrEqual(1);
      // el resto del menú no cambia
      for (const [k, code] of Object.entries(plan))
        if (k !== slotKey(3, "almuerzo")) expect(next[k]).toBe(code);
    }
  });

  it("mantiene el hierro del día cuando existe una alternativa con hierro", () => {
    for (const seed of SEEDS) {
      const base = ctx(POOLS_9, 9, seed);
      const plan = generateWeek(base)!;
      const { plan: next } = regenerateMeal(
        { ...base, random: seeded(seed + 5) },
        plan,
        2,
        "cena",
      );
      expect(
        summarize(next, index(POOLS_9), mealsForAge(9)).find(
          (x) => x.key === "iron",
        )!.ok,
      ).toBe(true);
    }
  });

  it("si no hay otra opción, no cambia nada", () => {
    const one: Pools = {
      ...POOLS_7,
      merienda: [c("M1", "merienda", { isIron: true })],
    };
    const plan = generateWeek(ctx(one, 7, 1))!;
    const r = regenerateMeal(ctx(one, 7, 2), plan, 1, "merienda");
    expect(r.changed).toBe(false);
    expect(r.plan).toBe(plan);
  });
});

describe("regenerateDay", () => {
  it("solo cambia ese día y conserva el pescado si lo tenía", () => {
    for (const seed of SEEDS) {
      const base = ctx(POOLS_9, 9, seed);
      const plan = generateWeek(base)!;
      const by = index(POOLS_9);
      const hadFish = mealsForAge(9).some(
        (m) => by.get(plan[slotKey(4, m)]!)?.isFish,
      );
      const { plan: next } = regenerateDay(
        { ...base, random: seeded(seed + 9) },
        plan,
        4,
      );
      for (const day of DAYS.filter((d) => d !== 4)) {
        for (const m of mealsForAge(9))
          expect(next[slotKey(day, m)]).toBe(plan[slotKey(day, m)]);
      }
      const hasFish = mealsForAge(9).some(
        (m) => by.get(next[slotKey(4, m)]!)?.isFish,
      );
      expect(hasFish).toBe(hadFish);
      expect(Object.keys(next)).toHaveLength(28);
    }
  });

  it("«Cambiar este día» siempre cambia el día y casi todas sus comidas", () => {
    for (const [pools, age] of [
      [POOLS_7, 7],
      [POOLS_9, 9],
    ] as const) {
      const meals = mealsForAge(age);
      let changedSlots = 0;
      let total = 0;
      for (const seed of SEEDS) {
        const base = ctx(pools, age, seed);
        const plan = generateWeek(base)!;
        const day = (seed % 7) + 1;
        const r = regenerateDay(
          { ...base, random: seeded(seed + 300) },
          plan,
          day,
        );
        expect(r.changed, `semilla ${seed}, día ${day}`).toBe(true);
        changedSlots += meals.filter(
          (m) => r.plan[slotKey(day, m)] !== plan[slotKey(day, m)],
        ).length;
        total += meals.length;
      }
      // Con la restricción de hierro algún hueco puede quedar igual, pero la gran mayoría cambia.
      expect(changedSlots / total).toBeGreaterThan(0.8);
    }
  });

  it("admite recetas del menú que ya no están en los pools (`known`)", () => {
    const outside = c("X1", "almuerzo", { isIron: true });
    const base = ctx(POOLS_9, 9, 3);
    const plan: Plan = {
      ...generateWeek(base)!,
      [slotKey(1, "almuerzo")]: "X1",
    };
    const r = regenerateMeal(
      { ...base, known: [outside] },
      plan,
      1,
      "almuerzo",
    );
    expect(r.changed).toBe(true);
    expect(r.plan[slotKey(1, "almuerzo")]).not.toBe("X1");
  });
});
