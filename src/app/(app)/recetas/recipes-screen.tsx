"use client";

import {
  Search,
  SearchX,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/recetario/empty-state";
import { GuideLinks } from "@/components/recetario/guide-links";
import { RecipeCard } from "@/components/recetario/recipe-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  activeFilterCount,
  EMPTY_FILTERS,
  useAllergens,
  useRecipes,
  type RecipeFilters as Filters,
} from "@/modules/recipes/recipes.queries";
import { MEAL_TYPES, type MealType } from "@/modules/recipes/recipes.schemas";
import { avoidedAllergens, useBaby } from "@/modules/babies/baby.queries";
import { usePantry } from "@/modules/pantry/pantry.queries";
import { RecipeFilters } from "./recipe-filters";

const MEAL_CHIPS: { value: MealType | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  ...MEAL_TYPES.filter((m) => m !== "base").map((m) => ({
    value: m,
    label: m[0]!.toUpperCase() + m.slice(1),
  })),
  { value: "base", label: "Base" },
];

export function RecipesScreen() {
  const baby = useBaby().data;
  const pantry = usePantry().data;
  // La edad y los alérgenos a evitar del perfil son el punto de partida; lo que la persona cambie los reemplaza.
  // «Solo lo que puedo cocinar» arranca activo si la familia ya marcó algo que no consigue.
  const defaults: Partial<Filters> = {
    ...(baby && {
      age: baby.ageMonths >= 6 ? Math.min(baby.ageMonths, 36) : null,
      exclude: avoidedAllergens(baby),
    }),
    ...(pantry && { cookable: pantry.unavailable.length > 0 }),
  };
  const [overrides, setOverrides] = useState<Partial<Filters>>({});
  const filters: Filters = { ...EMPTY_FILTERS, ...defaults, ...overrides };
  const [sheetOpen, setSheetOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");
  const patch = (p: Partial<Filters>) => setOverrides((o) => ({ ...o, ...p }));
  const clear = () =>
    setOverrides((o) => ({
      ...o,
      age: null,
      exclude: [],
      iron: false,
      cookable: false,
      tags: [],
    }));

  const allergens = useAllergens().data ?? [];
  const recipes = useRecipes({
    ...filters,
    q: useDebouncedValue(filters.q, 300),
  });
  const count = activeFilterCount(filters);

  const summary = [
    filters.age !== null && `Para un bebé de ${filters.age} meses`,
    filters.cookable && "con lo que consigues",
    filters.exclude.length > 0 &&
      `sin ${filters.exclude
        .map(
          (s) => allergens.find((a) => a.slug === s)?.name.toLowerCase() ?? s,
        )
        .join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const filterPanel = (onApply?: () => void) => (
    <RecipeFilters
      value={filters}
      onChange={patch}
      allergens={allergens}
      onClear={clear}
      onApply={onApply}
    />
  );

  return (
    <div className="xl:grid xl:grid-cols-[280px_1fr] xl:items-start xl:gap-8">
      <aside className="sticky top-8 hidden xl:block">
        <h2 className="mb-4 text-xl font-bold">Filtros</h2>
        {filterPanel()}
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
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
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            maxLength={80}
          />
        </div>

        <div className="flex items-center gap-3">
          <ScrollArea className="min-w-0 flex-1">
            <ToggleGroup
              variant="outline"
              aria-label="Tipo de comida"
              value={[filters.meal]}
              onValueChange={(v) =>
                patch({ meal: (v[0] as Filters["meal"] | undefined) ?? "all" })
              }
              className="pb-3"
            >
              {MEAL_CHIPS.map((c) => (
                <ToggleGroupItem
                  key={c.value}
                  value={c.value}
                  className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {filters.meal === c.value && "✓ "}
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <Button
            variant="outline"
            size="lg"
            className="mb-3 shrink-0 xl:hidden"
            onClick={() => setSheetOpen(true)}
          >
            <SlidersHorizontal aria-hidden /> Filtros
            {count > 0 && <Badge className="rounded-full">{count}</Badge>}
          </Button>
        </div>

        {summary && (
          <p className="text-base text-muted-foreground">{summary}</p>
        )}

        {recipes.isPending ? (
          <div className="grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[136px] w-full" />
            ))}
          </div>
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
          <EmptyState
            as="h2"
            icon={SearchX}
            title={
              filters.q.trim()
                ? `No encontramos recetas con «${filters.q.trim()}»`
                : "No encontramos recetas"
            }
            body="Prueba con otra palabra o quita algún filtro."
          >
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setOverrides({ ...EMPTY_FILTERS })}
            >
              Borrar búsqueda y filtros
            </Button>
          </EmptyState>
        ) : (
          <div
            className={`grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] ${
              recipes.isPlaceholderData ? "opacity-60" : ""
            }`}
          >
            {recipes.data.map((r) => (
              <RecipeCard key={r.code} recipe={r} />
            ))}
          </div>
        )}

        <div className="mt-4">
          <GuideLinks />
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className="max-h-[88dvh] overflow-y-auto md:max-h-none md:w-[420px] md:max-w-[420px]"
        >
          <SheetHeader className="min-h-[72px] justify-center">
            <SheetTitle className="text-[22px] font-bold">Filtros</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {filterPanel(() => setSheetOpen(false))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
