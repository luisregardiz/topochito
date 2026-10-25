import { TriangleAlert } from "lucide-react";
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

// Alérgeno que contiene la receta; en el detalle se dice «Contiene …».
export function AllergenBadge({
  allergen,
  detailed,
}: {
  allergen: RecipeAllergen;
  detailed?: boolean;
}) {
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
