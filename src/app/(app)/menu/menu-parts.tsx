"use client";

import {
  ChevronRight,
  CircleCheck,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { MEALS, MealThumb } from "@/components/recetario/meal";
import {
  AllergenBadge,
  IronBadge,
  MissingFoodsBadge,
} from "@/components/recetario/recipe-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  dayName,
  dayNumber,
  DAY_INITIALS,
  formatDayLong,
} from "@/modules/menu/menu.dates";
import type {
  Menu,
  MenuCheck,
  MenuDay,
  MenuMeal,
} from "@/modules/menu/menu.schemas";

export type Pending = { day: number; meal?: MenuMeal } | null;
export const isPending = (p: Pending, day: number, meal: MenuMeal) =>
  !!p && p.day === day && (p.meal === undefined || p.meal === meal);

const spin = (busy: boolean) =>
  busy ? (
    <LoaderCircle className="animate-spin" aria-hidden />
  ) : (
    <RefreshCw aria-hidden />
  );

export function DayPicker({
  menu,
  value,
  onChange,
}: {
  menu: Menu;
  value: number;
  onChange: (day: number) => void;
}) {
  return (
    <Tabs value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <ScrollArea className="w-full">
        {/* El TabsList de shadcn trae h-8 con un selector más específico: sin este override recorta los días. */}
        <TabsList
          className="h-auto w-max gap-2 bg-transparent p-1 pb-3 group-data-horizontal/tabs:h-auto"
          aria-label="Día de la semana"
        >
          {menu.days.map(({ day }) => (
            <TabsTrigger
              key={day}
              value={String(day)}
              aria-label={
                formatDayLong(menu.weekStart, day) +
                (day === menu.today ? " (hoy)" : "")
              }
              className="h-[76px] w-16 flex-none flex-col gap-0 rounded-md border border-input bg-transparent text-base data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
            >
              <span className="text-base">{DAY_INITIALS[day - 1]}</span>
              <span className="text-xl font-bold">
                {dayNumber(menu.weekStart, day)}
              </span>
              <span className="text-base leading-none">
                {day === menu.today ? "Hoy" : " "}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" className="max-md:hidden" />
      </ScrollArea>
    </Tabs>
  );
}

export function MealCard({
  day,
  meal,
  recipe,
  busy,
  avoid,
  onChange,
  onPick,
}: {
  day: number;
  meal: MenuMeal;
  recipe: MenuDay["meals"][number]["recipe"];
  busy: boolean;
  avoid: readonly string[];
  onChange: () => void;
  onPick: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Link
          href={`/recetas/${recipe.code}`}
          className="flex gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MealThumb meal={recipe.mealType} src={recipe.thumbUrl} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-base text-muted-foreground">
              <span>
                {MEALS[meal].label} ·{" "}
                <span className="font-mono">{recipe.code}</span>
              </span>
              <ChevronRight className="size-5 shrink-0" aria-hidden />
            </div>
            <h3 className="text-[19px] leading-snug font-bold">
              {recipe.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              <MissingFoodsBadge foods={recipe.missingFoods} />
              {recipe.isIronSource && <IronBadge note={recipe.ironNote} />}
              {recipe.allergens.map((a) => (
                <AllergenBadge
                  key={a.slug}
                  allergen={a}
                  avoid={avoid.includes(a.slug)}
                />
              ))}
            </div>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={onChange}
          aria-label={`Cambiar ${MEALS[meal].label.toLowerCase()} del ${dayName(day)}`}
        >
          {spin(busy)} Cambiar esta comida
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onPick}
          aria-label={`Elegir ${MEALS[meal].label.toLowerCase()} del ${dayName(day)}`}
        >
          <Search aria-hidden /> Elegir yo la receta
        </Button>
      </CardContent>
    </Card>
  );
}

// Hueco sin receta (menú armado a mano): se llena eligiendo una del catálogo.
export function EmptyMealCard({
  day,
  meal,
  onPick,
}: {
  day: number;
  meal: MenuMeal;
  onPick: () => void;
}) {
  const Icon = MEALS[meal].icon;
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <Icon className="size-5" aria-hidden /> {MEALS[meal].label} · sin
          receta
        </p>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={onPick}
          aria-label={`Elegir ${MEALS[meal].label.toLowerCase()} del ${dayName(day)}`}
        >
          <Plus aria-hidden /> Elegir receta
        </Button>
      </CardContent>
    </Card>
  );
}

const CheckRow = ({ check }: { check: MenuCheck }) => (
  <li className="flex gap-3">
    {check.ok ? (
      <CircleCheck
        className="mt-0.5 size-5 shrink-0 text-primary"
        aria-label="En orden"
      />
    ) : (
      <TriangleAlert
        className="mt-0.5 size-5 shrink-0 text-warning-foreground"
        aria-label="Para revisar"
      />
    )}
    <div>
      <p className="font-bold">{check.title}</p>
      <p className="text-muted-foreground">{check.detail}</p>
    </div>
  </li>
);

const allOk = (checks: MenuCheck[]) => checks.every((c) => c.ok);

// Móvil: Accordion cerrado. Tablet: columna siempre abierta. Escritorio: fichas junto a la semana.
export function SummaryAccordion({ checks }: { checks: MenuCheck[] }) {
  return (
    <Accordion className="rounded-md border px-4">
      <AccordionItem value="resumen" className="border-0">
        <AccordionTrigger className="h-auto min-h-14 items-center py-2 text-lg hover:no-underline">
          <span className="flex flex-col">
            <span className="font-bold">Resumen de la semana</span>
            <span className="text-base font-normal text-muted-foreground">
              {allOk(checks)
                ? "Hierro, pescado e hígado en orden"
                : "Hay cosas por revisar"}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-4 pb-2 text-base">
            {checks.map((c) => (
              <CheckRow key={c.key} check={c} />
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function SummaryCard({ checks }: { checks: MenuCheck[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Resumen de la semana</h2>
        <ul className="flex flex-col gap-4 text-base">
          {checks.map((c) => (
            <CheckRow key={c.key} check={c} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function SummaryChips({ checks }: { checks: MenuCheck[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Resumen de la semana">
      {checks.map((c) => (
        <li key={c.key}>
          <Badge variant={c.ok ? "secondary" : "warning"}>
            {c.ok ? <CircleCheck aria-hidden /> : <TriangleAlert aria-hidden />}
            {c.title}: {c.short}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

// Escritorio: una fila por día y una columna por comida. No es Table: cada celda es interactiva.
export function WeekGrid({
  menu,
  pending,
  avoid,
  onChangeMeal,
  onChangeDay,
  onPick,
  canChangeDay,
}: {
  menu: Menu;
  pending: Pending;
  avoid: readonly string[];
  onChangeMeal: (day: number, meal: MenuMeal) => void;
  onChangeDay: (day: number) => void;
  onPick: (day: number, meal: MenuMeal) => void;
  canChangeDay: boolean;
}) {
  const meals = menu.meals;
  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: `150px repeat(${meals.length}, minmax(0, 1fr))`,
      }}
    >
      <span />
      {meals.map((m) => {
        const Icon = MEALS[m].icon;
        return (
          <span key={m} className="flex items-center gap-2 px-1 font-bold">
            <Icon className="size-5" aria-hidden /> {MEALS[m].label}
          </span>
        );
      })}
      {menu.days.map((d) => (
        <WeekRow
          key={d.day}
          menu={menu}
          day={d}
          pending={pending}
          avoid={avoid}
          onChangeMeal={onChangeMeal}
          onChangeDay={onChangeDay}
          onPick={onPick}
          canChangeDay={canChangeDay}
        />
      ))}
    </div>
  );
}

function WeekRow({
  menu,
  day,
  pending,
  avoid,
  onChangeMeal,
  onChangeDay,
  onPick,
  canChangeDay,
}: {
  menu: Menu;
  day: MenuDay;
  pending: Pending;
  avoid: readonly string[];
  onChangeMeal: (day: number, meal: MenuMeal) => void;
  onChangeDay: (day: number) => void;
  onPick: (day: number, meal: MenuMeal) => void;
  canChangeDay: boolean;
}) {
  const today = day.day === menu.today;
  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-md border bg-card p-3",
          today && "border-l-4 border-l-primary",
        )}
      >
        <div>
          <p className="font-bold capitalize">{dayName(day.day)}</p>
          <p className="text-sm text-muted-foreground">
            {dayNumber(menu.weekStart, day.day)}
            {today && " · Hoy"}
          </p>
        </div>
        {canChangeDay && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-sm"
            disabled={!!pending && pending.day === day.day}
            onClick={() => onChangeDay(day.day)}
            aria-label={`Cambiar el día ${dayName(day.day)}`}
          >
            {spin(
              !!pending &&
                pending.day === day.day &&
                pending.meal === undefined,
            )}{" "}
            Cambiar día
          </Button>
        )}
      </div>
      {menu.meals.map((meal) => {
        const recipe = day.meals.find((m) => m.meal === meal)?.recipe;
        if (!recipe)
          return (
            <div
              key={meal}
              className="flex flex-col justify-center rounded-md border border-dashed bg-card p-3"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-fit px-2 text-sm"
                onClick={() => onPick(day.day, meal)}
                aria-label={`Elegir ${MEALS[meal].label.toLowerCase()} del ${dayName(day.day)}`}
              >
                <Plus aria-hidden /> Elegir receta
              </Button>
            </div>
          );
        return (
          <div
            key={meal}
            className={cn(
              "flex flex-col gap-2 rounded-md border bg-card p-3",
              today && "border-primary/40",
            )}
          >
            <Link
              href={`/recetas/${recipe.code}`}
              className="flex flex-col gap-1 rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="font-mono text-sm text-muted-foreground">
                {recipe.code}
              </span>
              <span className="line-clamp-2 leading-snug font-bold">
                {recipe.title}
              </span>
            </Link>
            <div className="flex flex-wrap gap-1">
              <MissingFoodsBadge foods={recipe.missingFoods} />
              {recipe.isIronSource && <IronBadge note={recipe.ironNote} />}
              {recipe.allergens.map((a) => (
                <AllergenBadge
                  key={a.slug}
                  allergen={a}
                  avoid={avoid.includes(a.slug)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-fit px-2 text-sm"
                disabled={isPending(pending, day.day, meal)}
                onClick={() => onChangeMeal(day.day, meal)}
                aria-label={`Cambiar ${MEALS[meal].label.toLowerCase()} del ${dayName(day.day)}`}
              >
                {spin(isPending(pending, day.day, meal))} Cambiar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-fit px-2 text-sm"
                onClick={() => onPick(day.day, meal)}
                aria-label={`Elegir ${MEALS[meal].label.toLowerCase()} del ${dayName(day.day)}`}
              >
                <Search aria-hidden /> Elegir
              </Button>
            </div>
          </div>
        );
      })}
    </>
  );
}
