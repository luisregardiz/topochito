import { Ban, ShoppingBasket, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { allergenLabel, ironLabel } from "@/modules/recipes/recipes.format";
import type { RecipeAllergen } from "@/modules/recipes/recipes.schemas";

export function IronBadge({
  note,
  detailed,
}: {
  note: string | null;
  detailed?: boolean;
}) {
  return (
    <Badge variant="iron">
      <span aria-hidden>●</span>
      {ironLabel(note, detailed)}
    </Badge>
  );
}

// Alérgeno que contiene la receta; en el detalle se dice «Contiene …». Si la familia lo evita, va en rojo sólido.
export function AllergenBadge({
  allergen,
  detailed,
  avoid,
}: {
  allergen: RecipeAllergen;
  detailed?: boolean;
  avoid?: boolean;
}) {
  if (avoid) {
    return (
      <Badge variant="destructive">
        <Ban aria-hidden />
        {allergen.name} · evitar
      </Badge>
    );
  }
  const text =
    detailed && !allergen.isOptional
      ? `Contiene ${allergen.name.toLowerCase()}`
      : allergenLabel(allergen);
  return (
    <Badge variant="allergen">
      <TriangleAlert aria-hidden />
      {text}
    </Badge>
  );
}

// Alimentos que la receta necesita y la familia no consigue (según Mi despensa).
export function MissingFoodsBadge({ foods }: { foods: string[] }) {
  if (foods.length === 0) return null;
  return (
    <Badge variant="warning">
      <ShoppingBasket aria-hidden />
      Te falta: {foods.join(", ")}
    </Badge>
  );
}
