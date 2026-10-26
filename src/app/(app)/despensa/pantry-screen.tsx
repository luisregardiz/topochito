"use client";

import {
  LoaderCircle,
  RefreshCw,
  Search,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/recetario/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePantry, useSavePantry } from "@/modules/pantry/pantry.queries";
import {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  type FoodItem,
  type PantryState,
} from "@/modules/pantry/pantry.schemas";
import { normalizeSearch } from "@/modules/recipes/recipes.service";

const fold = (s: string) => normalizeSearch(s).replaceAll("\\", "");

export function PantryScreen() {
  const pantry = usePantry();

  if (pantry.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (pantry.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle className="font-bold">
          No se pudo cargar tu despensa
        </AlertTitle>
        <AlertDescription>
          Revisa tu conexión e inténtalo de nuevo.
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => pantry.refetch()}
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return <PantryForm state={pantry.data} />;
}

function PantryForm({ state }: { state: PantryState }) {
  const save = useSavePantry();
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(
    new Set(state.unavailable),
  );
  const [q, setQ] = useState("");

  const term = fold(q.trim());
  const visible = state.foods.filter((f) => fold(f.name).includes(term));
  const sections = FOOD_CATEGORIES.map((category) => ({
    category,
    foods: visible.filter((f) => f.category === category),
    all: state.foods.filter((f) => f.category === category),
  })).filter((s) => s.foods.length > 0);

  const toggle = (slug: string) =>
    setUnavailable((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });
  const setMany = (foods: FoodItem[], available: boolean) =>
    setUnavailable((prev) => {
      const next = new Set(prev);
      for (const f of foods) {
        if (available) next.delete(f.slug);
        else next.add(f.slug);
      }
      return next;
    });

  const total = state.foods.length;
  const consigue = total - unavailable.size;

  function submit() {
    save.mutate([...unavailable], {
      onSuccess: (saved) =>
        toast.success("Guardamos tu despensa", {
          description: `Puedes cocinar ${saved.recipes.cookable} de ${saved.recipes.total} recetas.`,
        }),
    });
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-lg font-bold" aria-live="polite">
            Consigues {consigue} de {total} alimentos
          </p>
          <p className="text-muted-foreground">
            Con tu despensa guardada puedes cocinar {state.recipes.cookable} de{" "}
            {state.recipes.total} recetas.
          </p>
          <p className="text-base text-muted-foreground">
            El agua, el aceite y las hierbas y especias no se preguntan: los
            damos por hechos.
          </p>
        </CardContent>
      </Card>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Buscar un alimento"
          placeholder="Buscar un alimento"
          className="pl-11"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
        />
      </div>

      {sections.length === 0 ? (
        <EmptyState
          as="h2"
          icon={SearchX}
          title={`No encontramos «${q.trim()}»`}
          body="Prueba con otra palabra, por ejemplo «queso» o «pollo»."
        >
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setQ("")}
          >
            Borrar búsqueda
          </Button>
        </EmptyState>
      ) : (
        sections.map(({ category, foods, all }) => {
          const missing = all.filter((f) => unavailable.has(f.slug)).length;
          return (
            <section
              key={category}
              aria-labelledby={`cat-${category}`}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  id={`cat-${category}`}
                  className="text-[22px] font-bold xl:text-xl"
                >
                  {FOOD_CATEGORY_LABELS[category]}
                </h2>
                <Button
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setMany(foods, missing > 0)}
                  aria-label={`${missing > 0 ? "Marcar" : "Desmarcar"} todos: ${FOOD_CATEGORY_LABELS[category]}`}
                >
                  {missing > 0 ? "Marcar todos" : "Desmarcar todos"}
                </Button>
              </div>
              <ul className="flex flex-col divide-y rounded-md border bg-card">
                {foods.map((f) => (
                  <li key={f.slug}>
                    <Label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 text-lg font-normal xl:text-base">
                      <Checkbox
                        checked={!unavailable.has(f.slug)}
                        onCheckedChange={() => toggle(f.slug)}
                      />
                      <span
                        className={
                          unavailable.has(f.slug)
                            ? "text-muted-foreground line-through"
                            : undefined
                        }
                      >
                        {f.name}
                      </span>
                    </Label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {save.isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle className="font-bold">No pudimos guardar</AlertTitle>
          <AlertDescription>
            Tus cambios siguen en pantalla. Revisa tu conexión e inténtalo de
            nuevo.
            <Button variant="outline" className="mt-3 w-full" onClick={submit}>
              <RefreshCw aria-hidden /> Intentar de nuevo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="fixed inset-x-0 bottom-[76px] z-30 border-t bg-background/95 p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button
          size="lg"
          className="w-full md:w-auto md:min-w-48"
          onClick={submit}
          disabled={save.isPending}
        >
          {save.isPending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden /> Guardando…
            </>
          ) : (
            "Guardar"
          )}
        </Button>
      </div>
    </>
  );
}
