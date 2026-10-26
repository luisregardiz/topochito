"use client";

import { Check, Citrus, TriangleAlert } from "lucide-react";
import { BackButton } from "@/components/recetario/back-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBaby } from "@/modules/babies/baby.queries";
import { useFruitGuide } from "@/modules/guides/guides.queries";
import { cn } from "@/lib/utils";

// Dos bloques apilados, no columnas: el texto de cada corte es largo. El tramo del bebé lleva borde y «Tu bebé».
const Cut = ({
  title,
  text,
  active,
}: {
  title: string;
  text: string;
  active: boolean;
}) => (
  <div
    className={cn(
      "rounded-md border bg-muted/40 p-3",
      active && "border-2 border-primary",
    )}
  >
    <p className="flex items-center justify-between gap-2 text-base font-bold">
      {title}
      {active && (
        <span className="flex items-center gap-1 text-primary">
          <Check className="size-4" aria-hidden /> Tu bebé
        </span>
      )}
    </p>
    <p>{text}</p>
  </div>
);

export function FruitGuideScreen() {
  const { data, isPending, isError, refetch } = useFruitGuide();
  const babyAge = useBaby().data?.ageMonths ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5 md:p-8">
      <BackButton fallback="/recetas">Volver</BackButton>
      <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
        Cortes de fruta
      </h1>
      <p className="text-muted-foreground">
        Cómo cortar cada fruta para que sea segura según la edad.
      </p>

      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>
            No se pudo cargar la guía.
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ul className="grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {data.map((f) => (
            <li key={f.fruit}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-3">
                  <h2 className="flex items-center gap-2 text-[19px] leading-snug font-bold">
                    <Citrus
                      className="size-6 shrink-0 text-primary"
                      aria-hidden
                    />
                    {f.fruit}
                  </h2>
                  {f.caution && (
                    <Alert variant="warning">
                      <TriangleAlert />
                      <AlertDescription className="font-bold">
                        {f.caution}
                      </AlertDescription>
                    </Alert>
                  )}
                  <Cut
                    title="7–8 meses"
                    text={f.age7to8}
                    active={babyAge !== null && babyAge >= 7 && babyAge <= 8}
                  />
                  <Cut
                    title="9–11 meses"
                    text={f.age9to11}
                    active={babyAge !== null && babyAge >= 9 && babyAge <= 11}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
