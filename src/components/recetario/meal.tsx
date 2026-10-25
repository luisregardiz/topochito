import {
  Apple,
  CookingPot,
  Moon,
  Sun,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import type { MealType } from "@/modules/recipes/recipes.schemas";
import { cn } from "@/lib/utils";

export const MEALS: Record<
  MealType,
  { label: string; icon: LucideIcon; tint: string }
> = {
  desayuno: { label: "Desayuno", icon: Sunrise, tint: "bg-meal-desayuno" },
  almuerzo: { label: "Almuerzo", icon: Sun, tint: "bg-meal-almuerzo" },
  merienda: { label: "Merienda", icon: Apple, tint: "bg-meal-merienda" },
  cena: { label: "Cena", icon: Moon, tint: "bg-meal-cena" },
  base: { label: "Preparación base", icon: CookingPot, tint: "bg-meal-base" },
};

// shortcut: el dataset aún no tiene fotos; solo placeholder. Al añadir image_url, aceptar `src` y volver al placeholder si falla.
export function MealThumb({
  meal,
  className,
}: {
  meal: MealType;
  className?: string;
}) {
  const { icon: Icon, tint } = MEALS[meal];
  return (
    <div
      className={cn(
        "flex size-[88px] shrink-0 items-center justify-center rounded-md",
        tint,
        className,
      )}
      aria-hidden
    >
      <Icon className="size-8 text-foreground/70" />
    </div>
  );
}

export function RecipeImage({ meal }: { meal: MealType }) {
  const { icon: Icon, tint, label } = MEALS[meal];
  return (
    <div
      className={cn(
        "flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-md",
        tint,
      )}
    >
      <Icon className="size-12 text-foreground/70" aria-hidden />
      <span className="text-base font-bold text-foreground/70">{label}</span>
    </div>
  );
}
