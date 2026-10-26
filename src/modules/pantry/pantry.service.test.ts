import { describe, expect, it } from "vitest";
import type { FoodRef, Requirement } from "./pantry.availability";
import type { FoodItem } from "./pantry.schemas";
import { getPantry, savePantry } from "./pantry.service";

const food = (slug: string, name: string, staple = false): FoodRef => ({
  slug,
  name,
  staple,
});
const req = (...groups: FoodRef[][]): Requirement => ({
  position: 1,
  optional: false,
  groups,
});

const FOODS: FoodItem[] = [
  { slug: "pollo", name: "Pollo", category: "proteinas" },
  { slug: "salmon", name: "Salmón", category: "proteinas" },
  { slug: "yuca", name: "Yuca", category: "tuberculos" },
];
// 1 = pollo, 2 = salmón, 3 = yuca o salmón (alternativas), 4 = solo agua
const REQUIREMENTS = new Map<number, Requirement[]>([
  [1, [req([food("pollo", "Pollo")])]],
  [2, [req([food("salmon", "Salmón")])]],
  [3, [req([food("yuca", "Yuca"), food("salmon", "Salmón")])]],
  [4, [req([food("agua", "Agua", true)])]],
]);

function fakeRepo(initial: string[] = []) {
  let unavailable = [...initial];
  return {
    saved: () => unavailable,
    foods: async () => FOODS,
    foodSlugs: async () => FOODS.map((f) => f.slug),
    unavailable: async () => unavailable,
    save: async (_h: string, slugs: string[]) => void (unavailable = slugs),
    availability: async () => ({
      unavailable: new Set(unavailable),
      requirements: REQUIREMENTS,
    }),
  };
}

describe("getPantry", () => {
  it("con todo disponible se pueden cocinar todas las recetas", async () => {
    expect(await getPantry(fakeRepo(), "h1")).toEqual({
      foods: FOODS,
      unavailable: [],
      recipes: { cookable: 4, total: 4 },
    });
  });

  it("cuenta como cocinables solo las que no necesitan lo que falta (con alternativas y básicos)", async () => {
    const state = await getPantry(fakeRepo(["salmon"]), "h1");
    // sin salmón: la 2 no se puede; la 3 sí (tiene yuca); la 4 solo lleva agua
    expect(state.recipes).toEqual({ cookable: 3, total: 4 });
    expect(
      (await getPantry(fakeRepo(["salmon", "yuca"]), "h1")).recipes.cookable,
    ).toBe(2);
  });
});

describe("savePantry", () => {
  it("guarda la lista sin repetidos y devuelve el estado nuevo", async () => {
    const repo = fakeRepo();
    const r = await savePantry(repo, "h1", ["salmon", "salmon", "yuca"]);
    expect(r.ok).toBe(true);
    expect(repo.saved()).toEqual(["salmon", "yuca"]);
    if (r.ok) expect(r.state.recipes.cookable).toBe(2);
  });

  it("rechaza alimentos que no existen o que son básicos, sin guardar nada", async () => {
    const repo = fakeRepo(["pollo"]);
    expect(await savePantry(repo, "h1", ["kiwi"])).toEqual({
      ok: false,
      reason: "unknown_food",
    });
    expect(await savePantry(repo, "h1", ["agua"])).toEqual({
      ok: false,
      reason: "unknown_food",
    });
    expect(repo.saved()).toEqual(["pollo"]);
  });

  it("una lista vacía devuelve todo a «lo consigo»", async () => {
    const repo = fakeRepo(["pollo", "salmon"]);
    const r = await savePantry(repo, "h1", []);
    expect(r.ok && r.state.recipes.cookable).toBe(4);
  });
});
