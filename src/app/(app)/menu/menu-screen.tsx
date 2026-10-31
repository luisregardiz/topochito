"use client";

import {
  Baby,
  CalendarPlus,
  ClipboardList,
  LoaderCircle,
  Moon,
  RefreshCw,
  ShieldAlert,
  ShoppingBasket,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/recetario/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { avoidedAllergens, useBaby } from "@/modules/babies/baby.queries";
import { allergenWithArticle } from "@/modules/recipes/recipes.format";
import { dayName, formatDayLong, formatRange } from "@/modules/menu/menu.dates";
import { mealsForAge } from "@/modules/menu/menu.generator";
import { weekOf } from "@/modules/menu/menu.week";
import { useSettings } from "@/modules/households/households.queries";
import {
  useGenerateMenu,
  useMenu,
  useRegenerate,
  useSetEntries,
} from "@/modules/menu/menu.queries";
import type { EntryRef, Menu, MenuMeal } from "@/modules/menu/menu.schemas";
import type { RecipeListItem } from "@/modules/recipes/recipes.schemas";
import { MEALS } from "@/components/recetario/meal";
import {
  DayPicker,
  EmptyMealCard,
  isPending,
  MealCard,
  SummaryAccordion,
  SummaryCard,
  SummaryChips,
  WeekGrid,
} from "./menu-parts";
import { RecipePicker, type PickTarget } from "./recipe-picker";

const Title = ({ children }: { children?: React.ReactNode }) => (
  <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
    Menú de la semana{children}
  </h1>
);

export function MenuScreen() {
  const baby = useBaby();
  const menu = useMenu();

  if (baby.isPending || menu.isPending) {
    return (
      <>
        <Title />
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-24 w-full" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[136px] w-full" />
          ))}
        </div>
      </>
    );
  }
  if (baby.isError || menu.isError) {
    return (
      <>
        <Title />
        <Alert variant="destructive">
          <WifiOff />
          <AlertTitle className="font-bold">
            No pudimos cargar el menú
          </AlertTitle>
          <AlertDescription>
            Revisa tu conexión a internet e inténtalo de nuevo.
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => (baby.isError ? baby.refetch() : menu.refetch())}
            >
              <RefreshCw aria-hidden /> Intentar de nuevo
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }
  if (!baby.data) {
    return (
      <>
        <Title />
        <EmptyState
          as="h2"
          icon={Baby}
          title="Primero cuéntanos de tu bebé"
          body="Con su edad y sus alérgenos armamos un menú seguro para él."
        >
          <Link
            href="/bebe"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Indicar fecha de nacimiento
          </Link>
        </EmptyState>
      </>
    );
  }
  return (
    <MenuView
      ageMonths={baby.data.ageMonths}
      avoid={avoidedAllergens(baby.data)}
      menu={menu.data}
    />
  );
}

// Semana sin recetas para armarla a mano; solo existe en pantalla hasta que se elige la primera receta.
const blankMenu = (ageMonths: number, timeZone?: string): Menu => ({
  ...weekOf(new Date(), timeZone),
  ageMonths,
  meals: mealsForAge(ageMonths),
  days: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, meals: [] })),
  checks: [],
});

function MenuView({
  ageMonths,
  avoid,
  menu: stored,
}: {
  ageMonths: number;
  avoid: string[];
  menu: Menu | null;
}) {
  const gen = useGenerateMenu();
  const regen = useRegenerate();
  const setEntries = useSetEntries();
  const [day, setDay] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const timeZone = useSettings().data?.timeZone;
  const menu = stored ?? (manual ? blankMenu(ageMonths, timeZone) : null);

  const selected = day ?? menu?.today ?? 1;
  const mealCount = mealsForAge(ageMonths).length;
  const pending = regen.isPending ? regen.variables : null;
  const ageText = `${ageMonths} ${ageMonths === 1 ? "mes" : "meses"}`;

  function generate() {
    setConfirmOpen(false);
    gen.mutate(undefined, {
      onSuccess: () =>
        toast.success("Menú listo", {
          description: "Puedes cambiar cualquier comida.",
        }),
    });
  }

  function announce(previous: EntryRef[], done: string) {
    if (previous.length === 0) return toast("No hay otra opción para esto");
    toast.success(done, {
      action: { label: "Deshacer", onClick: () => setEntries.mutate(previous) },
    });
  }
  const failed = () =>
    toast.error("No pudimos hacer el cambio", {
      description: "Revisa tu conexión e inténtalo de nuevo.",
    });

  function pick(target: PickTarget, recipe: RecipeListItem) {
    const before = menu?.days
      .find((d) => d.day === target.day)
      ?.meals.find((m) => m.meal === target.meal)?.recipe;
    setPicking(null);
    setEntries.mutate([{ ...target, recipe: recipe.code }], {
      onSuccess: () =>
        toast.success(`Pusimos ${recipe.title}`, {
          ...(before && {
            action: {
              label: "Deshacer",
              onClick: () =>
                setEntries.mutate([{ ...target, recipe: before.code }]),
            },
          }),
        }),
      onError: failed,
    });
  }

  const changeMeal = (d: number, meal: MenuMeal) =>
    regen.mutate(
      { scope: "meal", day: d, meal },
      {
        onSuccess: ({ previous }) =>
          announce(
            previous,
            `Cambiamos el ${MEALS[meal].label.toLowerCase()} del ${dayName(d)}`,
          ),
        onError: failed,
      },
    );
  const changeDay = (d: number) =>
    regen.mutate(
      { scope: "day", day: d },
      {
        onSuccess: ({ previous }) =>
          announce(previous, `Cambiamos las comidas del ${dayName(d)}`),
        onError: failed,
      },
    );

  const generateButton = (className?: string) => (
    <Button
      size="lg"
      variant={stored ? "outline" : "default"}
      className={cn("w-full", className)}
      disabled={gen.isPending}
      onClick={() => (stored ? setConfirmOpen(true) : generate())}
    >
      {gen.isPending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden /> Generando…
        </>
      ) : (
        <>
          <RefreshCw aria-hidden /> Generar menú de la semana
        </>
      )}
    </Button>
  );

  const genError = gen.isError && (
    <Alert variant="destructive">
      {gen.error instanceof ApiError && gen.error.status === 422 ? (
        <TriangleAlert />
      ) : (
        <WifiOff />
      )}
      <AlertTitle className="font-bold">No pudimos generar el menú</AlertTitle>
      <AlertDescription>
        {gen.error instanceof ApiError && gen.error.status === 422
          ? gen.error.message
          : "Revisa tu conexión a internet e intenta de nuevo."}
        <Button variant="outline" className="mt-3 w-full" onClick={generate}>
          <RefreshCw aria-hidden /> Intentar de nuevo
        </Button>
      </AlertDescription>
    </Alert>
  );

  if (!menu) {
    return (
      <>
        <Title />
        {gen.isPending ? (
          <div className="flex flex-col gap-3" aria-busy>
            <p className="text-lg font-bold">Armando el menú…</p>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[136px] w-full" />
            ))}
          </div>
        ) : (
          <EmptyState
            as="h2"
            icon={CalendarPlus}
            title="Todavía no hay menú para esta semana"
            body={`Lo armamos al azar con recetas para un bebé de ${ageText}. Después puedes cambiar cualquier comida.`}
          >
            {genError}
            {generateButton()}
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => setManual(true)}
            >
              <ClipboardList aria-hidden /> Armar yo mi menú
            </Button>
          </EmptyState>
        )}
      </>
    );
  }

  const dayMeals = menu.days.find((d) => d.day === selected)?.meals ?? [];

  // El perfil pudo cambiar después de generar el menú: avisa de las recetas que ya no son seguras.
  const conflicts = menu.days
    .flatMap((d) => d.meals)
    .filter((m) => m.recipe.allergens.some((a) => avoid.includes(a.slug)));
  const conflictNames = [
    ...new Map(
      conflicts
        .flatMap((m) => m.recipe.allergens)
        .filter((a) => avoid.includes(a.slug))
        .map((a) => [a.slug, allergenWithArticle(a)]),
    ).values(),
  ];

  // Lo mismo con la despensa: la familia pudo marcar un alimento como «no lo consigo» después de generar el menú.
  const lacking = menu.days
    .flatMap((d) => d.meals)
    .filter((m) => m.recipe.missingFoods.length > 0);
  const lackingNames = [
    ...new Set(lacking.flatMap((m) => m.recipe.missingFoods)),
  ];

  return (
    <>
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-2">
          <Title />
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {formatRange(menu.weekStart)} ·{" "}
            <Badge variant="secondary">
              <Baby aria-hidden /> Bebé de {ageText}
            </Badge>
            <span className="hidden xl:inline">
              · {mealCount} comidas al día
              {ageMonths < 8 && " (la cena aparece desde los 8 meses)"}
            </span>
          </p>
        </div>
        <div className="hidden xl:block xl:w-72">{generateButton()}</div>
      </header>

      {genError}

      {lacking.length > 0 && (
        <Alert variant="warning">
          <ShoppingBasket />
          <AlertTitle className="font-bold">
            Este menú tiene recetas con alimentos que no consigues
          </AlertTitle>
          <AlertDescription>
            Te faltan: {lackingNames.join(", ")}.{" "}
            {lacking.length === 1
              ? "Está en 1 comida"
              : `Están en ${lacking.length} comidas`}{" "}
            de este menú. Genera un menú nuevo para cambiarlas.
            <Button
              className="mt-3 w-full"
              onClick={() => setConfirmOpen(true)}
            >
              <RefreshCw aria-hidden /> Generar menú nuevo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {conflicts.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle className="font-bold">
            Este menú tiene recetas con {conflictNames.join(" y ")}
          </AlertTitle>
          <AlertDescription>
            Marcaste {conflictNames.join(" y ")} como «evitar» en el perfil de
            tu bebé, pero{" "}
            {conflicts.length === 1
              ? "sigue en 1 comida"
              : `siguen en ${conflicts.length} comidas`}{" "}
            de este menú. Genera un menú nuevo para quitar
            {conflicts.length === 1 ? "la" : "las"}.
            <Button
              className="mt-3 w-full"
              onClick={() => setConfirmOpen(true)}
            >
              <RefreshCw aria-hidden /> Generar menú nuevo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Móvil y tablet: un día a la vez */}
      <div className="flex flex-col gap-4 xl:hidden" data-testid="day-view">
        {generateButton()}
        <DayPicker menu={menu} value={selected} onChange={setDay} />
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,640px)_260px] md:items-start">
          <div className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold">
              {formatDayLong(menu.weekStart, selected)}
            </h2>
            {menu.meals.map((meal) => {
              const recipe = dayMeals.find((m) => m.meal === meal)?.recipe;
              const target = { day: selected, meal };
              return recipe ? (
                <MealCard
                  key={meal}
                  day={selected}
                  meal={meal}
                  recipe={recipe}
                  avoid={avoid}
                  busy={isPending(pending, selected, meal)}
                  onChange={() => changeMeal(selected, meal)}
                  onPick={() => setPicking(target)}
                />
              ) : (
                <EmptyMealCard
                  key={meal}
                  day={selected}
                  meal={meal}
                  onPick={() => setPicking(target)}
                />
              );
            })}
            {ageMonths < 8 && (
              <Alert>
                <Moon />
                <AlertTitle className="font-bold">
                  La cena aparece desde los 8 meses
                </AlertTitle>
                <AlertDescription>
                  Tu bebé tiene {ageText}: por ahora son {mealCount} comidas al
                  día.
                </AlertDescription>
              </Alert>
            )}
            {stored && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={pending?.day === selected}
                onClick={() => changeDay(selected)}
              >
                <RefreshCw aria-hidden /> Cambiar este día
              </Button>
            )}
            <div className="md:hidden">
              <SummaryAccordion checks={menu.checks} />
            </div>
          </div>
          <div className="hidden md:block">
            <SummaryCard checks={menu.checks} />
          </div>
        </div>
      </div>

      {/* Escritorio: la semana completa */}
      <div className="hidden flex-col gap-4 xl:flex" data-testid="week-grid">
        <SummaryChips checks={menu.checks} />
        <WeekGrid
          menu={menu}
          pending={pending}
          avoid={avoid}
          onChangeMeal={changeMeal}
          onChangeDay={changeDay}
          onPick={(d, meal) => setPicking({ day: d, meal })}
          canChangeDay={!!stored}
        />
      </div>

      <RecipePicker
        target={picking}
        ageMonths={ageMonths}
        avoid={avoid}
        onClose={() => setPicking(null)}
        onPick={pick}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="p-5 text-base sm:max-w-[480px]"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-[26px] leading-tight font-bold">
              ¿Generar un menú nuevo?
            </DialogTitle>
            <DialogDescription className="text-lg text-foreground xl:text-base">
              Reemplaza el menú de esta semana, incluidos los cambios que
              hiciste a mano.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full" onClick={generate}>
              Generar menú nuevo
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
