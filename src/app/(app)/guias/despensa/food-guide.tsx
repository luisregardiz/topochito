"use client";

import { Baby, Ban, Search, SearchX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { BackButton } from "@/components/recetario/back-button";
import { EmptyState } from "@/components/recetario/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFoodGuide } from "@/modules/guides/guides.queries";
import { foodAgeBadge } from "@/modules/recipes/recipes.format";
import { normalizeSearch } from "@/modules/recipes/recipes.service";

export function FoodGuideScreen() {
  const { data, isPending, isError, refetch } = useFoodGuide();
  const [q, setQ] = useState("");
  // El texto se pliega igual que en la búsqueda de recetas (sin tildes); aquí no hace falta escapar LIKE.
  const term = normalizeSearch(q.trim()).replaceAll("\\", "");
  const items = (data ?? []).filter((i) =>
    normalizeSearch(i.food).replaceAll("\\", "").includes(term),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5 md:p-8">
      <BackButton fallback="/recetas">Volver</BackButton>
      <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
        Guía de la despensa
      </h1>
      <p className="text-muted-foreground">
        {data
          ? `${data.length} alimentos: desde qué edad y cómo prepararlos.`
          : "Desde qué edad y cómo prepararlos."}
      </p>

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
      {q.trim() && data && items.length > 0 && (
        <p className="text-base text-muted-foreground" aria-live="polite">
          {items.length} {items.length === 1 ? "alimento" : "alimentos"}
        </p>
      )}

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
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
      ) : items.length === 0 ? (
        <EmptyState
          as="h2"
          icon={SearchX}
          title={`No encontramos «${q.trim()}» en la despensa`}
          body="Prueba con otra palabra, por ejemplo «queso» o «pescado»."
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
        <>
          <div className="hidden grid-cols-[220px_160px_1fr] gap-4 px-4 text-base font-bold text-muted-foreground md:grid">
            <span>Alimento</span>
            <span>Desde</span>
            <span>Cómo prepararlo</span>
          </div>
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const age = foodAgeBadge(item.fromAge);
              return (
                <li key={item.food}>
                  <Card>
                    <CardContent className="flex flex-col gap-3 md:grid md:grid-cols-[220px_160px_1fr] md:items-start md:gap-4">
                      <h2 className="text-[19px] leading-snug font-bold">
                        {item.food}
                      </h2>
                      <div>
                        <Badge variant={age.variant}>
                          {age.variant === "secondary" && <Baby aria-hidden />}
                          {age.variant === "warning" && (
                            <TriangleAlert aria-hidden />
                          )}
                          {age.variant === "destructive" && <Ban aria-hidden />}
                          {age.text}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-3">
                        <p>
                          <span className="font-bold md:hidden">
                            Cómo prepararlo:{" "}
                          </span>
                          {item.preparation}
                        </p>
                        {item.caution && (
                          <Alert variant="warning">
                            <TriangleAlert />
                            <AlertDescription>{item.caution}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
