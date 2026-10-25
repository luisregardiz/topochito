"use client";

import {
  Baby,
  ChevronRight,
  Copy,
  CookingPot,
  Info,
  MapPinOff,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/recetario/back-button";
import { EmptyState } from "@/components/recetario/empty-state";
import { MEALS, RecipeImage } from "@/components/recetario/meal";
import { AllergenBadge, IronBadge } from "@/components/recetario/recipe-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiError } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { useBaby } from "@/modules/babies/baby.queries";
import type { BabyProfile } from "@/modules/babies/baby.schemas";
import { useRecipe } from "@/modules/recipes/recipes.queries";
import {
  ageInTramo,
  ageLabel,
  allergenWithArticle,
  isPrecaution,
  tramoLabel,
} from "@/modules/recipes/recipes.format";
import type { RecipeDetail } from "@/modules/recipes/recipes.schemas";

const Section = ({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={cn("flex flex-col gap-3", className)}>
    <h2 className="text-[22px] font-bold xl:text-xl">{title}</h2>
    {children}
  </section>
);

export function RecipeDetailScreen({ code }: { code: string }) {
  const { data: recipe, error, isPending, refetch } = useRecipe(code);
  const baby = useBaby().data ?? null;

  return (
    <main className="mx-auto w-full max-w-[1040px] p-5 md:p-8">
      <BackButton fallback="/recetas">Volver a recetas</BackButton>
      {isPending ? (
        <Loading />
      ) : error ? (
        <NotAvailable
          notFound={
            error instanceof ApiError &&
            (error.status === 404 || error.status === 400)
          }
          retry={() => refetch()}
        />
      ) : (
        <Recipe recipe={recipe} baby={baby} />
      )}
    </main>
  );
}

function Loading() {
  return (
    <div className="mt-4 grid gap-8 md:grid-cols-2" aria-busy>
      <div className="flex flex-col gap-4">
        <Skeleton className="aspect-[4/3] w-full" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

function NotAvailable({
  notFound,
  retry,
}: {
  notFound: boolean;
  retry: () => void;
}) {
  return (
    <div className="mt-8">
      {notFound ? (
        <EmptyState
          icon={MapPinOff}
          title="No encontramos esa receta"
          body="Puede que el enlace esté incompleto o que la receta ya no exista."
        >
          <Link
            href="/recetas"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Ver todas las recetas
          </Link>
        </EmptyState>
      ) : (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle className="font-bold">
            No se pudo cargar la receta
          </AlertTitle>
          <AlertDescription>
            Revisa tu conexión e inténtalo de nuevo.
            <Button variant="outline" className="mt-3 w-full" onClick={retry}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Con el perfil del bebé: avisa si la receta lleva un alérgeno a evitar y marca el tramo «Tu bebé».
function Recipe({
  recipe,
  baby,
}: {
  recipe: RecipeDetail;
  baby: BabyProfile | null;
}) {
  const babyAge = baby?.ageMonths ?? null;
  const avoided = recipe.allergens.filter(
    (a) => baby?.allergens[a.slug] === "avoid",
  );
  const meal = MEALS[recipe.mealType];
  const precaution = isPrecaution(recipe.note);

  return (
    // En móvil los hijos de los dos `contents` se ordenan con `order-*` (ingredientes y pasos antes que edad y notas);
    // desde md quedan dos columnas y la izquierda se fija en escritorio.
    <div className="mt-4 flex flex-col gap-8 md:grid md:grid-cols-2 md:items-start xl:gap-12">
      <div className="contents md:flex md:flex-col md:gap-8 xl:sticky xl:top-8">
        {avoided.length > 0 && (
          <Alert variant="destructive" className="order-first">
            <ShieldAlert />
            <AlertTitle className="font-bold">
              Tu bebé debe evitar{" "}
              {avoided.map((a) => allergenWithArticle(a)).join(" y ")}
            </AlertTitle>
            <AlertDescription>
              Esta receta lleva{" "}
              {avoided.map((a) => allergenWithArticle(a)).join(" y ")}. En el
              perfil de tu bebé {avoided.length === 1 ? "lo" : "los"} marcaste
              como «evitar».
              <Link
                href="/recetas"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mt-3 w-full",
                )}
              >
                Ver recetas sin{" "}
                {avoided.map((a) => allergenWithArticle(a)).join(" ni ")}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <header className="order-1 flex flex-col gap-4">
          <RecipeImage meal={recipe.mealType} />
          <div>
            <p className="text-base text-muted-foreground">
              {meal.label} · <span className="font-mono">{recipe.code}</span>
            </p>
            <h1 className="text-[28px] leading-tight font-bold md:text-[32px]">
              {recipe.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <Baby aria-hidden />
              {ageLabel(recipe.minAgeMonths)}
            </Badge>
            {recipe.isIronSource && (
              <IronBadge note={recipe.ironNote} detailed />
            )}
            {recipe.allergens.map((a) => (
              <AllergenBadge
                key={a.slug}
                allergen={a}
                detailed
                avoid={baby?.allergens[a.slug] === "avoid"}
              />
            ))}
            {recipe.tags.map((t) => (
              <Badge key={t.slug} variant="outline">
                {t.label}
              </Badge>
            ))}
          </div>
        </header>

        {recipe.ageAdaptations.length > 0 && (
          <AgeAdaptation
            tramos={recipe.ageAdaptations}
            babyAge={babyAge}
            className="order-4"
          />
        )}

        {recipe.note && (
          <Alert
            variant={precaution ? "warning" : "default"}
            className="order-5"
          >
            {precaution ? <TriangleAlert /> : <Info />}
            <AlertTitle className="font-bold">
              {precaution ? "Precaución al preparar" : "Notas importantes"}
            </AlertTitle>
            <AlertDescription>{recipe.note}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="contents md:flex md:flex-col md:gap-8">
        <Ingredients items={recipe.ingredients} className="order-2" />

        <Section title="Pasos" className="order-3">
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span
                  className="font-display w-8 shrink-0 text-[40px] leading-none text-primary"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <p className="pt-1">
                  <span className="sr-only">Paso {i + 1}: </span>
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        {recipe.uses.length > 0 && (
          <Section title="Esta receta usa…" className="order-6">
            <div className="flex flex-col gap-2">
              {recipe.uses.map((u) => (
                <Link
                  key={u.code}
                  href={`/recetas/${u.code}`}
                  className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="flex min-h-10 items-center gap-3">
                      <CookingPot
                        className="size-6 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="flex-1">
                        <span className="font-mono text-base text-muted-foreground">
                          {u.code}
                        </span>{" "}
                        <span className="font-bold">{u.title}</span>
                      </span>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Ingredients({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });

  return (
    <Section title="Ingredientes" className={className}>
      <ul className="flex flex-col divide-y rounded-md border">
        {items.map((text, i) => (
          <li key={i}>
            <Label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 text-lg font-normal xl:text-base">
              <Checkbox
                checked={checked.has(i)}
                onCheckedChange={() => toggle(i)}
              />
              <span
                className={cn(
                  checked.has(i) && "text-muted-foreground line-through",
                )}
              >
                {text}
              </span>
            </Label>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={async () => {
          await copyText(items.join("\n"));
          toast.success("Ingredientes copiados");
        }}
      >
        <Copy aria-hidden /> Copiar ingredientes
      </Button>
    </Section>
  );
}

function AgeAdaptation({
  tramos,
  babyAge,
  className,
}: {
  tramos: RecipeDetail["ageAdaptations"];
  babyAge: number | null;
  className?: string;
}) {
  const babyIndex = tramos.findIndex((t) => ageInTramo(babyAge, t));
  const [selected, setSelected] = useState(Math.max(babyIndex, 0));
  const current = tramos[selected] ?? tramos[0]!;

  return (
    <Section title="Según la edad de tu bebé" className={className}>
      <ToggleGroup
        variant="outline"
        size="lg"
        aria-label="Edad del bebé"
        value={[String(selected)]}
        onValueChange={(v) => v[0] !== undefined && setSelected(Number(v[0]))}
        className="w-full flex-wrap"
      >
        {tramos.map((t, i) => (
          <ToggleGroupItem
            key={t.minAgeMonths}
            value={String(i)}
            className="flex-1 flex-col gap-0 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {tramoLabel(t)}
            {i === babyIndex && <span className="text-base">✓ Tu bebé</span>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p aria-live="polite">{current.instructions}</p>
    </Section>
  );
}
