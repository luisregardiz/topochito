import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { foodGuide, fruitCutGuide } from "@/db/schema";

export const guidesRepository = {
  food: () =>
    getDb()
      .select({
        food: foodGuide.food,
        fromAge: foodGuide.fromAge,
        preparation: foodGuide.preparation,
        caution: foodGuide.caution,
      })
      .from(foodGuide)
      .orderBy(asc(foodGuide.sortOrder)),
  fruits: () =>
    getDb()
      .select({
        fruit: fruitCutGuide.fruit,
        age78: fruitCutGuide.age78,
        age911: fruitCutGuide.age911,
        caution: fruitCutGuide.caution,
      })
      .from(fruitCutGuide)
      .orderBy(asc(fruitCutGuide.sortOrder)),
};
