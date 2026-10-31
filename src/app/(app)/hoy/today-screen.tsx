"use client";

import {
  Baby,
  CalendarPlus,
  ChevronRight,
  MessageCircle,
  Plus,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/recetario/empty-state";
import { InstallHint } from "@/components/recetario/install-hint";
import { MEALS, MealThumb } from "@/components/recetario/meal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBaby } from "@/modules/babies/baby.queries";
import { formatDayLong } from "@/modules/menu/menu.dates";
import { useToday } from "@/modules/menu/menu.queries";
import type { Today } from "@/modules/menu/menu.schemas";
import { addDays } from "@/lib/zoned-time";

const Title = () => (
  <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
    Hoy
  </h1>
);

// Texto para WhatsApp (por ahora sin imagen de vista previa).
function shareText(today: Today, origin: string) {
  const lines = today.meals
    .filter((m) => m.recipe)
    .map((m) => `• ${m.time} ${MEALS[m.meal].label}: ${m.recipe!.title}`);
  return [`Menú de hoy del bebé:`, ...lines, "", `${origin}/hoy`].join("\n");
}

export function TodayScreen() {
  const baby = useBaby();
  const today = useToday();

  if (today.isPending || baby.isPending) {
    return (
      <>
        <Title />
        <div className="flex flex-col gap-3" aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[112px] w-full" />
          ))}
        </div>
      </>
    );
  }
  if (today.isError) {
    return (
      <>
        <Title />
        <Alert variant="destructive">
          <WifiOff />
          <AlertTitle className="font-bold">
            No pudimos cargar el día
          </AlertTitle>
          <AlertDescription>
            Revisa tu conexión a internet e inténtalo de nuevo.
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => today.refetch()}
            >
              <RefreshCw aria-hidden /> Intentar de nuevo
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }
  if (!today.data) {
    return (
      <>
        <Title />
        <EmptyState
          as="h2"
          icon={Baby}
          title="Primero cuéntanos de tu bebé"
          body="Con su edad armamos sus comidas de cada día."
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

  const t = today.data;
  const hasRecipes = t.meals.some((m) => m.recipe);
  const weekStart = addDays(t.date, 1 - t.day);
  const nickname = baby.data?.nickname;

  return (
    <>
      <header className="flex flex-col gap-1">
        <Title />
        <p className="text-lg text-muted-foreground xl:text-base">
          {formatDayLong(weekStart, t.day)}
          {nickname && ` · comidas de ${nickname}`}
        </p>
      </header>

      {!hasRecipes ? (
        <EmptyState
          as="h2"
          icon={CalendarPlus}
          title="Todavía no hay menú para hoy"
          body="Genera el menú de la semana o elige tú cada comida."
        >
          <Link
            href="/menu"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Ir al menú de la semana
          </Link>
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-3">
          {t.meals.map((m) => (
            <li key={m.meal}>
              {/* Aquí irá el estado de cada comida (pendiente/registrada) cuando exista el registro de comidas. */}
              {m.recipe ? (
                <Link
                  href={`/recetas/${m.recipe.code}`}
                  className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="flex items-center gap-3">
                      <MealThumb meal={m.meal} src={m.recipe.thumbUrl} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="text-base text-muted-foreground">
                          <time className="font-bold text-foreground">
                            {m.time}
                          </time>{" "}
                          · {MEALS[m.meal].label}
                        </p>
                        <p className="text-[19px] leading-snug font-bold">
                          {m.recipe.title}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </CardContent>
                  </Card>
                </Link>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-between gap-3">
                    <p className="text-base text-muted-foreground">
                      <time className="font-bold text-foreground">
                        {m.time}
                      </time>{" "}
                      · {MEALS[m.meal].label} sin receta
                    </p>
                    <Link
                      href="/menu"
                      className={buttonVariants({ variant: "outline" })}
                    >
                      <Plus aria-hidden /> Elegir
                    </Link>
                  </CardContent>
                </Card>
              )}
            </li>
          ))}
        </ol>
      )}

      {hasRecipes && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText(t, typeof window === "undefined" ? "" : window.location.origin))}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full",
          )}
        >
          <MessageCircle aria-hidden /> Compartir menú de hoy
        </a>
      )}

      <InstallHint />
    </>
  );
}
