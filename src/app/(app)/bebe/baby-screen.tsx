"use client";

import {
  Ban,
  Check,
  Info,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiError } from "@/lib/api-client";
import { ageInMonths, currentYearMonth } from "@/modules/babies/baby.age";
import { useBaby, useSaveBaby } from "@/modules/babies/baby.queries";
import type {
  AllergenStatus,
  BabyProfile,
} from "@/modules/babies/baby.schemas";
import { MAX_BABY_AGE_MONTHS } from "@/modules/babies/baby.service";
import { useAllergens } from "@/modules/recipes/recipes.queries";
import type { AllergenOption } from "@/modules/recipes/recipes.schemas";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
].map((label, i) => ({ value: String(i + 1), label }));

type Choice = AllergenStatus | "none";
const CHOICES: { value: Choice; label: string; className: string }[] = [
  {
    value: "none",
    label: "No introducido",
    className:
      "aria-pressed:border-2 aria-pressed:border-foreground aria-pressed:bg-secondary aria-pressed:text-foreground",
  },
  {
    value: "introduced",
    label: "Ya lo come",
    className:
      "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground",
  },
  {
    value: "avoid",
    label: "Evitar",
    className:
      "aria-pressed:border-destructive aria-pressed:bg-destructive aria-pressed:text-destructive-foreground",
  },
];

export function BabyScreen() {
  const baby = useBaby();
  const allergens = useAllergens();

  if (baby.isPending || allergens.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (baby.isError || allergens.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle className="font-bold">
          No se pudo cargar el perfil
        </AlertTitle>
        <AlertDescription>
          Revisa tu conexión e inténtalo de nuevo.
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() =>
              baby.isError ? baby.refetch() : allergens.refetch()
            }
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return <BabyForm initial={baby.data} allergens={allergens.data} />;
}

function BabyForm({
  initial,
  allergens,
}: {
  initial: BabyProfile | null;
  allergens: AllergenOption[];
}) {
  const save = useSaveBaby();
  const [month, setMonth] = useState<number | null>(
    initial?.birthMonth ?? null,
  );
  const [year, setYear] = useState<number | null>(initial?.birthYear ?? null);
  const [statuses, setStatuses] = useState<Record<string, AllergenStatus>>(
    initial?.allergens ?? {},
  );
  const [missingDate, setMissingDate] = useState(false);

  const thisYear = currentYearMonth(new Date()).year;
  const years = Array.from({ length: 4 }, (_, i) => ({
    value: String(thisYear - i),
    label: String(thisYear - i),
  }));
  const age = month && year ? ageInMonths({ month, year }, new Date()) : null;
  const dateProblem =
    age === null
      ? null
      : age < 0
        ? "Esa fecha todavía no llega."
        : age > MAX_BABY_AGE_MONTHS
          ? "La app es para bebés de hasta 3 años."
          : null;

  function submit() {
    if (!month || !year) return setMissingDate(true);
    if (dateProblem) return;
    save.mutate(
      { birthMonth: month, birthYear: year, allergens: statuses },
      {
        onSuccess: (saved) =>
          toast.success("Guardamos los datos del bebé", {
            description: `El menú y las recetas ya usan ${saved.ageMonths} ${saved.ageMonths === 1 ? "mes" : "meses"}.`,
          }),
      },
    );
  }

  const choose = (slug: string, value: Choice) =>
    setStatuses((prev) => {
      const next = { ...prev };
      if (value === "none") delete next[slug];
      else next[slug] = value;
      return next;
    });

  return (
    <>
      {!initial && (
        <Alert>
          <Info />
          <AlertDescription>
            Mientras no indiques la fecha de nacimiento, mostramos todas las
            recetas.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[340px_1fr] xl:items-start">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-[22px] font-bold xl:text-xl">
              Fecha de nacimiento
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="mes" className="text-base font-bold">
                  Mes
                </Label>
                <Select
                  items={MONTHS}
                  value={month === null ? null : String(month)}
                  onValueChange={(v) => {
                    setMonth(v === null ? null : Number(v));
                    setMissingDate(false);
                  }}
                >
                  <SelectTrigger id="mes" className="w-full">
                    <SelectValue placeholder="Elige" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="anio" className="text-base font-bold">
                  Año
                </Label>
                <Select
                  items={years}
                  value={year === null ? null : String(year)}
                  onValueChange={(v) => {
                    setYear(v === null ? null : Number(v));
                    setMissingDate(false);
                  }}
                >
                  <SelectTrigger id="anio" className="w-full">
                    <SelectValue placeholder="Elige" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.value} value={y.value}>
                        {y.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {missingDate && (
              <p role="alert" className="text-base font-bold text-destructive">
                Elige el mes y el año.
              </p>
            )}
            <Separator />
            <div aria-live="polite">
              <p className="text-base text-muted-foreground">Tiene</p>
              {dateProblem ? (
                <p className="font-bold text-destructive">{dateProblem}</p>
              ) : age === null ? (
                <p className="text-muted-foreground">
                  Aquí verás la edad de tu bebé.
                </p>
              ) : (
                <p className="font-display text-[64px] leading-none">
                  {age} {age === 1 ? "mes" : "meses"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h2 className="text-[22px] font-bold xl:text-xl">Alérgenos</h2>
              <p className="text-muted-foreground">
                Marca cómo va cada uno. Lo que marques como «Evitar» no
                aparecerá en el menú.
              </p>
            </div>
            <ul className="flex flex-col">
              {allergens.map((a, i) => {
                const current: Choice = statuses[a.slug] ?? "none";
                return (
                  <li key={a.slug}>
                    {i > 0 && <Separator className="my-3" />}
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <span className="font-bold" id={`al-${a.slug}`}>
                        {a.name}
                      </span>
                      <ToggleGroup
                        variant="outline"
                        aria-labelledby={`al-${a.slug}`}
                        value={[current]}
                        onValueChange={(v) =>
                          v[0] && choose(a.slug, v[0] as Choice)
                        }
                        className="w-full md:w-[420px]"
                      >
                        {CHOICES.map((c) => (
                          <ToggleGroupItem
                            key={c.value}
                            value={c.value}
                            className={`h-14 flex-1 gap-1 px-1 text-base font-bold xl:h-12 ${c.className}`}
                          >
                            {current === c.value &&
                              c.value === "introduced" && <Check aria-hidden />}
                            {current === c.value && c.value === "avoid" && (
                              <Ban aria-hidden />
                            )}
                            {c.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {save.isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle className="font-bold">No pudimos guardar</AlertTitle>
          <AlertDescription>
            {save.error instanceof ApiError && save.error.status === 422
              ? save.error.message
              : "Tus cambios siguen en pantalla. Revisa tu conexión e inténtalo de nuevo."}
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
