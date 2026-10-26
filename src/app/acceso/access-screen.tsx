"use client";

import {
  Clock,
  Info,
  Lock,
  LoaderCircle,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/recetario/empty-state";
import { FamilyCodeInput } from "@/components/recetario/family-code-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";
import { isFamilyCodeComplete } from "@/lib/family-code";

export function AccessScreen({ deleted }: { deleted: boolean }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Recetario borrado por inactividad: la cookie ya no sirve.
    if (deleted) void api.post("/access/logout").catch(() => {});
    // Los enlaces «Escribir el código a mano» llegan con #codigo.
    if (window.location.hash === "#codigo") codeRef.current?.focus();
  }, [deleted]);

  return (
    <>
      <header>
        {deleted ? (
          <p className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
            Recetario<span className="text-primary">.</span>
          </p>
        ) : (
          <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
            Recetario<span className="text-primary">.</span>
          </h1>
        )}
        <p className="mt-2 text-lg text-muted-foreground xl:text-base">
          Recetas y menú de la semana para la alimentación de tu bebé.
        </p>
      </header>

      {deleted && (
        <EmptyState
          as="h1"
          icon={Trash2}
          title="Este recetario ya no existe"
          body="Nadie lo abrió en 30 días y se borró, como avisamos en Mi recetario. Puedes crear uno nuevo o entrar con el código de otro."
        >
          <Button
            size="lg"
            className="w-full"
            onClick={() => nameRef.current?.focus()}
          >
            Crear un recetario nuevo
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => codeRef.current?.focus()}
          >
            Tengo otro código
          </Button>
        </EmptyState>
      )}

      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
        <CreateCard inputRef={nameRef} />
        <Separator className="md:hidden" />
        <CodeCard inputRef={codeRef} />
      </div>
    </>
  );
}

function CreateCard({ inputRef }: { inputRef: React.Ref<HTMLInputElement> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<
    "closed" | "limited" | "failed" | null
  >(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setProblem(null);
    try {
      await api.post("/households", { name });
      toast.success("Tu recetario está listo");
      router.replace("/menu");
      router.refresh();
    } catch (e) {
      setPending(false);
      const err = e instanceof ApiError ? e : null;
      setProblem(
        err?.status === 429
          ? "limited"
          : err?.code === "signup_closed"
            ? "closed"
            : "failed",
      );
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <h2 className="text-[22px] font-bold xl:text-xl">
            Crear mi recetario
          </h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre" className="text-base font-bold">
              Tu nombre o el de tu familia
            </Label>
            <Input
              ref={inputRef}
              id="nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: Familia Pérez"
              required
              maxLength={80}
              autoComplete="off"
            />
          </div>
          {problem === "closed" && (
            <Alert>
              <Info />
              <AlertTitle className="font-bold">
                Por ahora no se están creando recetarios nuevos
              </AlertTitle>
              <AlertDescription>
                Si alguien de tu familia ya tiene uno, pídele el código y entra
                aquí abajo.
              </AlertDescription>
            </Alert>
          )}
          {problem === "limited" && (
            <Alert variant="destructive">
              <Clock />
              <AlertTitle className="font-bold">
                Demasiadas solicitudes
              </AlertTitle>
              <AlertDescription>
                Ya se crearon varios recetarios desde esta conexión. Espera un
                rato e inténtalo otra vez.
              </AlertDescription>
            </Alert>
          )}
          {problem === "failed" && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle className="font-bold">
                No se pudo crear el recetario
              </AlertTitle>
              <AlertDescription>
                Revisa el nombre e inténtalo de nuevo.
              </AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden /> Creando…
              </>
            ) : (
              "Crear mi recetario"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CodeCard({ inputRef }: { inputRef: React.Ref<HTMLInputElement> }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<
    "incomplete" | "wrong" | "limited" | "failed" | null
  >(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFamilyCodeComplete(code)) return setProblem("incomplete"); // el botón nunca se deshabilita
    setPending(true);
    setProblem(null);
    try {
      await api.post("/access", { code });
      router.replace("/menu");
      router.refresh();
    } catch (e) {
      setPending(false);
      const status = e instanceof ApiError ? e.status : 0;
      setProblem(
        status === 429 ? "limited" : status === 401 ? "wrong" : "failed",
      );
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <h2 className="text-[22px] font-bold xl:text-xl">
            Acceder al recetario de mi bebé
          </h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="codigo" className="text-base font-bold">
              Escribe el código que te compartieron
            </Label>
            <FamilyCodeInput
              ref={inputRef}
              value={code}
              onChange={(v) => {
                setCode(v);
                setProblem(null);
              }}
              describedBy="codigo-ayuda"
            />
            <p id="codigo-ayuda" className="text-base text-muted-foreground">
              Son 8 letras o números. El guion se pone solo.
            </p>
            {problem === "incomplete" && (
              <p role="alert" className="text-base font-bold text-destructive">
                Faltan letras o números
              </p>
            )}
          </div>
          {problem === "wrong" && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle className="font-bold">
                Código incorrecto. Revisa las letras y los números.
              </AlertTitle>
            </Alert>
          )}
          {problem === "limited" && (
            <Alert variant="destructive">
              <Clock />
              <AlertTitle className="font-bold">Demasiados intentos</AlertTitle>
              <AlertDescription>
                Por seguridad, espera 15 minutos antes de probar otro código.
              </AlertDescription>
            </Alert>
          )}
          {problem === "failed" && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle className="font-bold">
                No se pudo verificar el código
              </AlertTitle>
              <AlertDescription>
                Inténtalo de nuevo en un momento.
              </AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            size="lg"
            variant="outline"
            className="w-full"
            disabled={pending}
          >
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden /> Entrando…
              </>
            ) : (
              <>
                {problem === "limited" && <Lock aria-hidden />}
                Entrar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
