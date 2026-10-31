"use client";

import { Share, Smartphone, SquarePlus, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isIos, isStandalone, readFlag, writeFlag } from "@/lib/platform";

// Chrome/Android lo emite si la app es instalable; iOS no tiene aviso y se instala desde «Compartir».
type InstallPrompt = Event & { prompt: () => Promise<unknown> };

const DISMISSED = "topochito:install-hint-dismissed";
const noop = () => () => {};

// Guía de iPhone/iPad: Compartir → Agregar a inicio (también la usa «Activar avisos» si la app no está instalada).
export function IosInstallGuide() {
  return (
    <ol className="mt-2 flex flex-col gap-3">
      <li className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
          <Share className="size-5" aria-hidden />
        </span>
        <span>
          1. En Safari, toca <b>Compartir</b> (abajo en el iPhone, arriba en el
          iPad).
        </span>
      </li>
      <li className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
          <SquarePlus className="size-5" aria-hidden />
        </span>
        <span>
          2. Elige <b>Agregar a inicio</b> y toca <b>Agregar</b>.
        </span>
      </li>
    </ol>
  );
}

export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [closed, setClosed] = useState(false);
  // Lecturas del navegador: en el servidor el aviso no se muestra, así no hay diferencias al hidratar.
  const ios = useSyncExternalStore(
    noop,
    () => isIos() && !isStandalone(),
    () => false,
  );
  const dismissed = useSyncExternalStore(
    noop,
    () => readFlag(DISMISSED),
    () => true,
  );

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (closed || dismissed || (!prompt && !ios)) return null;

  const dismiss = () => {
    writeFlag(DISMISSED);
    setClosed(true);
  };

  return (
    <Alert className="relative">
      <Smartphone />
      <AlertTitle className="pr-10 font-bold">
        Ponla en tu pantalla de inicio
      </AlertTitle>
      <AlertDescription>
        {prompt ? (
          <>
            Ábrela como una app, sin buscarla en el navegador.
            <Button
              className="mt-3 w-full"
              onClick={() => {
                void prompt.prompt();
                setPrompt(null);
              }}
            >
              Instalar app
            </Button>
          </>
        ) : (
          <IosInstallGuide />
        )}
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        onClick={dismiss}
        aria-label="No mostrar más"
      >
        <X aria-hidden />
      </Button>
    </Alert>
  );
}
