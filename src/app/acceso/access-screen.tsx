"use client";

import { clearPrivateCaches } from "@/components/service-worker";
import { Clock, Lock, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/recetario/empty-state";
import { FamilyCodeInput } from "@/components/recetario/family-code-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";
import { isFamilyCodeComplete } from "@/lib/family-code";
import { cn } from "@/lib/utils";

export function AccessScreen({ deleted }: { deleted: boolean }) {
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Recetario borrado o acceso revocado: la cookie ya no sirve.
    if (deleted) {
      void api.post("/access/logout").catch(() => {});
      void clearPrivateCaches();
    }
    // Los enlaces «Escribir el código a mano» llegan con #codigo.
    if (window.location.hash === "#codigo") codeRef.current?.focus();
  }, [deleted]);

  return (
    <>
      <header>
        {deleted ? (
          <p className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
            topochito<span className="text-primary">.</span>
          </p>
        ) : (
          <h1 className="font-display text-[32px] leading-tight md:text-4xl xl:text-[32px]">
            topochito<span className="text-primary">.</span>
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
          title="Ya no puedes entrar a este recetario"
          body="Puede que nadie lo abriera en 30 días y se borrara, o que alguien de la familia te quitara el acceso. Pide una invitación nueva o el código, o crea un recetario nuevo."
        >
          <Link
            href="/empezar"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Crear un recetario nuevo
          </Link>
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
        <CreateCard />
        <Separator className="md:hidden" />
        <CodeCard inputRef={codeRef} />
      </div>
    </>
  );
}

function CreateCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-[22px] font-bold xl:text-xl">Crear mi recetario</h2>
        <p className="text-lg xl:text-base">
          Toma menos de un minuto: la edad de tu bebé, sus horarios y listo.
        </p>
        <Link
          href="/empezar"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Crear mi recetario
        </Link>
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
      await clearPrivateCaches();
      router.replace("/hoy");
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
