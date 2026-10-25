import type { FoodGuideItem, FruitCutItem } from "./guides.schemas";

type FruitRow = {
  fruit: string;
  age78: string;
  age911: string;
  caution: string | null;
};

export const listFoodGuide = (repo: { food: () => Promise<FoodGuideItem[]> }) =>
  repo.food();

// Los nombres age_7_8/age_9_11 de la tabla se exponen como age7to8/age9to11.
export async function listFruitCuts(repo: {
  fruits: () => Promise<FruitRow[]>;
}): Promise<FruitCutItem[]> {
  return (await repo.fruits()).map(({ age78, age911, ...f }) => ({
    ...f,
    age7to8: age78,
    age9to11: age911,
  }));
}
