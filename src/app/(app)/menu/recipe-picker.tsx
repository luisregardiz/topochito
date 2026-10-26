"use client";

import { Search, SearchX, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { MEALS, MealThumb } from "@/components/recetario/meal";
import {
  AllergenBadge,
  IronBadge,
  MissingFoodsBadge,
} from "@/components/recetario/recipe-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useMediaQuery } from "@/lib/use-media-query";
import { dayName } from "@/modules/menu/menu.dates";
import type { MenuMeal } from "@/modules/menu/menu.schemas";
import { EMPTY_FILTERS, useRecipes } from "@/modules/recipes/recipes.queries";
import type { RecipeListItem } from "@/modules/recipes/recipes.schemas";

export type PickTarget = { day: number; meal: MenuMeal };

// Elegir a mano la receta de un hueco: solo recetas de esa comida y de la edad del bebé.
// Las que tienen un alérgeno que la familia evita se ven marcadas y piden confirmación («Poner igual»).
export function RecipePicker({
  target,
  ageMonths,
  avoid,
  onClose,
  onPick,
}: {
  target: PickTarget | null;
  ageMonths: number;
  avoid: readonly string[];
  onClose: () => void;
  onPick: (target: PickTarget, recipe: RecipeListItem) => void;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className="max-h-[88dvh] md:max-h-none md:w-[480px] md:max-w-[480px]"
      >
        {target && (
          <PickerBody
            key={`${target.day}:${target.meal}`}
            target={target}
            ageMonths={ageMonths}
            avoid={avoid}
            onPick={onPick}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PickerBody({
  target,
  ageMonths,
  avoid,
  onPick,
}: {
  target: PickTarget;
  ageMonths: number;
  avoid: readonly string[];
  onPick: (target: PickTarget, recipe: RecipeListItem) => void;
}) {
  const [q, setQ] = useState("");
  const [confirming, setConfirming] = useState<RecipeListItem | null>(null);
  const recipes = useRecipes({
    ...EMPTY_FILTERS,
    q: useDebouncedValue(q, 300),
    meal: target.meal,
    age: Math.min(Math.max(ageMonths, 6), 36),
  });
  const label = MEALS[target.meal].label;
  const conflicts = (r: RecipeListItem) =>
    r.allergens.filter((a) => avoid.includes(a.slug));

  function choose(r: RecipeListItem) {
    if (conflicts(r).length > 0) setConfirming(r);
    else onPick(target, r);
  }

  return (
    <>
      <SheetHeader className="min-h-[72px] justify-center">
        <SheetTitle className="text-[22px] font-bold">
          Elegir {label.toLowerCase()}
        </SheetTitle>
        <SheetDescription className="capitalize">
          {dayName(target.day)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Buscar por nombre o ingrediente"
            placeholder="Buscar por nombre o ingrediente"
            className="pl-11"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={80}
          />
        </div>

        {confirming && (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle className="font-bold">
              {confirming.title} tiene{" "}
              {conflicts(confirming)
                .map((a) => a.name.toLowerCase())
                .join(" y ")}
            </AlertTitle>
            <AlertDescription>
              Marcaste ese alérgeno como «evitar» en el perfil de tu bebé.
              <Button
                className="mt-3 w-full"
                onClick={() => onPick(target, confirming)}
              >
                Poner en el menú igual
              </Button>
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={() => setConfirming(null)}
              >
                Elegir otra
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {recipes.isPending ? (
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[104px] w-full" />
            ))
          ) : recipes.isError ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle className="font-bold">
                No se pudieron cargar las recetas
              </AlertTitle>
              <AlertDescription>
                Revisa tu conexión e inténtalo de nuevo.
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => recipes.refetch()}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : recipes.data.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-muted-foreground">
              <SearchX className="size-5" aria-hidden />
              {q.trim()
                ? `No hay ${label.toLowerCase()}s con «${q.trim()}»`
                : `No hay recetas de ${label.toLowerCase()} para esta edad`}
            </p>
          ) : (
            recipes.data.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() => choose(r)}
                className="flex gap-3 rounded-md border bg-card p-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <MealThumb meal={r.mealType} src={r.thumbUrl} />
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-base text-muted-foreground">
                    <span className="font-mono">{r.code}</span>
                  </span>
                  <span className="text-[19px] leading-snug font-bold">
                    {r.title}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <MissingFoodsBadge foods={r.missingFoods} />
                    {r.isIronSource && <IronBadge note={r.ironNote} />}
                    {r.allergens.map((a) => (
                      <AllergenBadge
                        key={a.slug}
                        allergen={a}
                        avoid={avoid.includes(a.slug)}
                      />
                    ))}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
