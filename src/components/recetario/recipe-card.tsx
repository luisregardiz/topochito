import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { RecipeListItem } from "@/modules/recipes/recipes.schemas";
import { MEALS, MealThumb } from "./meal";
import { AllergenBadge, IronBadge } from "./recipe-badges";

export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link
      href={`/recetas/${recipe.code}`}
      className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex gap-3">
          <MealThumb meal={recipe.mealType} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-base text-muted-foreground">
              <span>
                {MEALS[recipe.mealType].label} ·{" "}
                <span className="font-mono">{recipe.code}</span>
              </span>
              <ChevronRight className="size-5 shrink-0" aria-hidden />
            </div>
            <h3 className="text-[19px] leading-snug font-bold">
              {recipe.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {recipe.isIronSource && <IronBadge note={recipe.ironNote} />}
              {recipe.allergens.map((a) => (
                <AllergenBadge key={a.slug} allergen={a} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
