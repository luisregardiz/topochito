"use client";

import { Citrus, TriangleAlert } from "lucide-react";
import { BackButton } from "@/components/recetario/back-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFruitGuide } from "@/modules/guides/guides.queries";

// Dos bloques apilados, no columnas: el texto de cada corte es largo. `babyAge` llegará con el perfil del bebé.
const Cut = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-md border bg-muted/40 p-3">
    <p className="text-base font-bold">{title}</p>
    <p>{text}</p>
  </div>
);

export function FruitGuideScreen() {
  const { data, isPending, isError, refetch } = useFruitGuide();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5 md:p-8">
      <BackButton fallback="/recetas">Volver</BackButton>
      <h1 className="font-display text-[40px] leading-none md:text-5xl xl:text-[40px]">
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
                  <Cut title="7–8 meses" text={f.age7to8} />
                  <Cut title="9–11 meses" text={f.age9to11} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
