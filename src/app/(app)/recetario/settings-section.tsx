"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MEALS } from "@/components/recetario/meal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSaveSettings,
  useSettings,
} from "@/modules/households/households.queries";
import {
  COUNTRIES,
  isTimeZone,
  type Country,
  type HouseholdSettings,
} from "@/modules/households/households.schemas";
import { MENU_MEALS } from "@/modules/menu/menu.schemas";

const COUNTRY_ITEMS = [
  ...Object.entries(COUNTRIES).map(([value, label]) => ({ value, label })),
  { value: "otro", label: "Otro país" },
];

export function SettingsSection() {
  const settings = useSettings();
  return (
    <section aria-labelledby="horarios" className="flex flex-col gap-3">
      <h2 id="horarios" className="text-[22px] font-bold xl:text-xl">
        Horarios y zona horaria
      </h2>
      {settings.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : settings.isError ? (
        <p className="text-muted-foreground">No pudimos cargar los ajustes.</p>
      ) : (
        <SettingsForm initial={settings.data} />
      )}
    </section>
  );
}

function SettingsForm({ initial }: { initial: HouseholdSettings }) {
  const save = useSaveSettings();
  const [mealTimes, setMealTimes] = useState(initial.mealTimes);
  const [timeZone, setTimeZone] = useState(initial.timeZone);
  const [country, setCountry] = useState<string>(initial.country ?? "otro");
  const tzValid = isTimeZone(timeZone);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tzValid) return;
    save.mutate(
      {
        mealTimes,
        timeZone,
        country: country === "otro" ? null : (country as Country),
      },
      {
        onSuccess: () => toast.success("Guardamos los ajustes"),
        onError: () =>
          toast.error("No pudimos guardar", {
            description: "Revisa los datos y tu conexión.",
          }),
      },
    );
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            {MENU_MEALS.map((m) => (
              <div key={m} className="flex flex-col gap-2">
                <Label htmlFor={`ajuste-${m}`} className="text-base font-bold">
                  {MEALS[m].label}
                </Label>
                <Input
                  id={`ajuste-${m}`}
                  type="time"
                  required
                  value={mealTimes[m]}
                  onChange={(e) =>
                    setMealTimes((t) => ({ ...t, [m]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <p className="text-base text-muted-foreground">
            La cena se usa desde los 8 meses.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ajuste-zona" className="text-base font-bold">
              Zona horaria
            </Label>
            <Input
              id="ajuste-zona"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value.trim())}
              list="ajuste-zonas"
              autoComplete="off"
              aria-invalid={!tzValid}
            />
            <datalist id="ajuste-zonas">
              {Intl.supportedValuesOf("timeZone").map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            {!tzValid && (
              <p role="alert" className="text-base font-bold text-destructive">
                No reconocemos esa zona horaria.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ajuste-pais" className="text-base font-bold">
              País
            </Label>
            <Select
              items={COUNTRY_ITEMS}
              value={country}
              onValueChange={(v) => v && setCountry(v)}
            >
              <SelectTrigger id="ajuste-pais" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_ITEMS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            size="lg"
            variant="outline"
            className="w-full"
            disabled={save.isPending || !tzValid}
          >
            {save.isPending && (
              <LoaderCircle className="animate-spin" aria-hidden />
            )}
            Guardar ajustes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
