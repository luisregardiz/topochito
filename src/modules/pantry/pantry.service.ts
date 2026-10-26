import { missingFoods, type Requirement } from "./pantry.availability";
import type { FoodItem, PantryState } from "./pantry.schemas";

type Repo = {
  foods: () => Promise<FoodItem[]>;
  foodSlugs: () => Promise<string[]>;
  unavailable: (householdId: string) => Promise<string[]>;
  save: (householdId: string, slugs: string[]) => Promise<void>;
  availability: (householdId: string) => Promise<{
    unavailable: Set<string>;
    requirements: Map<number, Requirement[]>;
  }>;
};

export async function getPantry(
  repo: Repo,
  householdId: string,
): Promise<PantryState> {
  const [foods, { unavailable, requirements }] = await Promise.all([
    repo.foods(),
    repo.availability(householdId),
  ]);
  const cookable = [...requirements.values()].filter(
    (reqs) => missingFoods(reqs, unavailable).length === 0,
  ).length;
  return {
    foods,
    unavailable: [...unavailable],
    recipes: { cookable, total: requirements.size },
  };
}

// Reemplaza la lista de alimentos que la familia no consigue. Rechaza alimentos que no existen o que son básicos.
export async function savePantry(
  repo: Repo,
  householdId: string,
  slugs: string[],
): Promise<
  { ok: true; state: PantryState } | { ok: false; reason: "unknown_food" }
> {
  const known = new Set(await repo.foodSlugs());
  const unique = [...new Set(slugs)];
  if (unique.some((s) => !known.has(s)))
    return { ok: false, reason: "unknown_food" };
  await repo.save(householdId, unique);
  return { ok: true, state: await getPantry(repo, householdId) };
}
