"use client";

import { clearPrivateCaches } from "@/components/service-worker";
import {
  ArrowLeft,
  Clock,
  Copy,
  Info,
  LoaderCircle,
  MessageCircle,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { MEALS } from "@/components/recetario/meal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { ageInMonths, currentYearMonth } from "@/modules/babies/baby.age";
import { MAX_BABY_AGE_MONTHS } from "@/modules/babies/baby.service";
import {
  COUNTRIES,
  DEFAULT_MEAL_TIMES,
  isTimeZone,
  type Country,
  type MealTimes,
} from "@/modules/households/households.schemas";
import { mealsForAge } from "@/modules/menu/menu.generator";
import { MENU_MEALS } from "@/modules/menu/menu.schemas";
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
const COUNTRY_ITEMS = [
  ...Object.entries(COUNTRIES).map(([value, label]) => ({ value, label })),
  { value: "otro", label: "Otro país" },
];
const STEPS = ["Tu bebé", "Horarios", "Dónde viven"] as const;

const noop = () => () => {};
const detectedTimeZone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isTimeZone(tz) ? tz : "America/Caracas";
  } catch {
    return "America/Caracas";
  }
};

export function OnboardingScreen({
  allergens,
}: {
  allergens: AllergenOption[];
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [nickname, setNickname] = useState("");
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [introduced, setIntroduced] = useState<string[]>([]);
  const [mealTimes, setMealTimes] = useState<MealTimes>(DEFAULT_MEAL_TIMES);
  const [country, setCountry] = useState<string>("VE");
  // La zona del teléfono solo se conoce en el navegador: en el servidor se usa la de respaldo (sin desajuste al hidratar).
  const detected = useSyncExternalStore(
    noop,
    detectedTimeZone,
    () => "America/Caracas",
  );
  const [typedTimeZone, setTimeZone] = useState<string | null>(null);
  const timeZone = typedTimeZone ?? detected;
  const [website, setWebsite] = useState(""); // honeypot
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const now = new Date();
  const thisYear = currentYearMonth(now).year;
  const years = Array.from({ length: 4 }, (_, i) => ({
    value: String(thisYear - i),
    label: String(thisYear - i),
  }));
  const age = month && year ? ageInMonths({ month, year }, now) : null;
  const meals = mealsForAge(age ?? 0);

  function next(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    if (step === 0) {
      if (!name.trim()) return setProblem("Escribe el nombre de la familia.");
      if (age === null)
        return setProblem("Elige el mes y el año de nacimiento.");
      if (age < 0) return setProblem("Esa fecha todavía no llega.");
      if (age > MAX_BABY_AGE_MONTHS)
        return setProblem("La app es para bebés de hasta 3 años.");
    }
    if (step === 2) {
      if (!isTimeZone(timeZone))
        return setProblem("No reconocemos esa zona horaria.");
      return void submit();
    }
    setStep(step + 1);
  }

  async function submit() {
    setPending(true);
    try {
      const { data } = await api.post<{ code: string }>("/households", {
        name,
        label: label.trim() || undefined,
        website,
        baby: {
          nickname: nickname.trim() || undefined,
          birthMonth: month,
          birthYear: year,
          introduced,
        },
        mealTimes,
        country: country === "otro" ? null : (country as Country),
        timeZone,
      });
      await clearPrivateCaches();
      setCode(data.code);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setProblem(
        err?.status === 429
          ? "Ya se crearon varios recetarios desde esta conexión. Espera un rato e inténtalo otra vez."
          : err?.status === 403 || err?.status === 422
            ? err.message
            : "No se pudo crear el recetario. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  if (code) return <Done code={code} name={name} />;

  return (
    <form onSubmit={next} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <p className="text-base text-muted-foreground">
          Paso {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>
      <h1 className="font-display text-[28px] leading-tight">
        {step === 0 && "Cuéntanos de tu bebé"}
        {step === 1 && "¿A qué hora come?"}
        {step === 2 && "¿Dónde viven?"}
      </h1>

      {/* Honeypot: fuera de la vista y del orden de tabulación; una persona nunca lo llena. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Sitio web
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {step === 0 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Field id="familia" label="Nombre de la familia">
              <Input
                id="familia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej.: Familia Pérez"
                maxLength={80}
                autoComplete="off"
              />
            </Field>
            <Field id="quien" label="¿Quién eres? (opcional)">
              <Input
                id="quien"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej.: Mamá"
                maxLength={40}
                autoComplete="off"
              />
            </Field>
            <Field id="apodo" label="Apodo del bebé (opcional)">
              <Input
                id="apodo"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ej.: Topo"
                maxLength={30}
                autoComplete="off"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="mes" label="Mes de nacimiento">
                <Select
                  items={MONTHS}
                  value={month === null ? null : String(month)}
                  onValueChange={(v) => setMonth(v === null ? null : Number(v))}
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
              </Field>
              <Field id="anio" label="Año">
                <Select
                  items={years}
                  value={year === null ? null : String(year)}
                  onValueChange={(v) => setYear(v === null ? null : Number(v))}
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
              </Field>
            </div>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-base font-bold">
                ¿Qué alérgenos ya come? (opcional)
              </legend>
              {allergens.map((a) => {
                const id = `alergeno-${a.slug}`;
                return (
                  <label
                    key={a.slug}
                    htmlFor={id}
                    className="flex min-h-12 items-center gap-3 text-lg xl:text-base"
                  >
                    <Checkbox
                      id={id}
                      checked={introduced.includes(a.slug)}
                      onCheckedChange={(on) =>
                        setIntroduced((prev) =>
                          on
                            ? [...prev, a.slug]
                            : prev.filter((s) => s !== a.slug),
                        )
                      }
                    />
                    {a.name}
                  </label>
                );
              })}
            </fieldset>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            {MENU_MEALS.filter((m) => meals.includes(m)).map((m) => (
              <Field key={m} id={`hora-${m}`} label={MEALS[m].label}>
                <Input
                  id={`hora-${m}`}
                  type="time"
                  required
                  value={mealTimes[m]}
                  onChange={(e) =>
                    setMealTimes((t) => ({ ...t, [m]: e.target.value }))
                  }
                />
              </Field>
            ))}
            {!meals.includes("cena") && (
              <Alert>
                <Info />
                <AlertDescription>
                  La cena aparece desde los 8 meses. Podrás ajustar su hora en
                  los ajustes.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Field id="pais" label="País">
              <Select
                items={COUNTRY_ITEMS}
                value={country}
                onValueChange={(v) => v && setCountry(v)}
              >
                <SelectTrigger id="pais" className="w-full">
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
            </Field>
            <Field id="zona" label="Zona horaria">
              <Input
                id="zona"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value.trim())}
                list="zonas"
                autoComplete="off"
              />
              <datalist id="zonas">
                {Intl.supportedValuesOf("timeZone").map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
              <p className="text-base text-muted-foreground">
                La tomamos de tu teléfono. Las horas de las comidas y los avisos
                usan esta zona.
              </p>
            </Field>
          </CardContent>
        </Card>
      )}

      {problem && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle className="font-bold">{problem}</AlertTitle>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden /> Creando…
            </>
          ) : step === STEPS.length - 1 ? (
            "Crear mi recetario"
          ) : (
            "Siguiente"
          )}
        </Button>
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setProblem(null);
              setStep(step - 1);
            }}
          >
            <ArrowLeft aria-hidden /> Atrás
          </Button>
        ) : (
          <Link
            href="/acceso"
            className="text-center text-base text-muted-foreground underline"
          >
            Ya tengo un código
          </Link>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

// El código se muestra al terminar (luego sigue en «Mi recetario» para quien tenga sesión).
function Done({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const text = `Código del recetario de ${name} en topochito: ${code}\nEntra en ${typeof window === "undefined" ? "" : window.location.origin}/acceso`;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[28px] leading-tight">
        ¡Tu recetario está listo!
      </h1>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <p className="text-base text-muted-foreground">
            Tu código de familia
          </p>
          <p className="rounded-md bg-muted px-4 py-3 text-center font-mono text-[30px] tracking-[0.12em]">
            {code}
          </p>
          <Alert variant="warning">
            <Clock />
            <AlertTitle className="font-bold">
              Guárdalo: es la forma de recuperar el acceso
            </AlertTitle>
            <AlertDescription>
              Envíatelo por WhatsApp o anótalo en un lugar seguro.
            </AlertDescription>
          </Alert>
          <Button
            size="lg"
            className="w-full"
            onClick={async () => {
              await copyText(code);
              toast.success("Código copiado");
            }}
          >
            <Copy aria-hidden /> Copiar código
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full",
            )}
          >
            <MessageCircle aria-hidden /> Enviar a WhatsApp
          </a>
        </CardContent>
      </Card>
      <Button
        size="lg"
        variant="outline"
        className="w-full"
        onClick={() => {
          router.replace("/hoy");
          router.refresh();
        }}
      >
        Ir a mi recetario
      </Button>
    </div>
  );
}
