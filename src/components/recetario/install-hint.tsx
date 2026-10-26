"use client";

import { Share, Smartphone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Chrome/Android lo emite si la app es instalable; iOS no tiene aviso y se instala desde «Compartir».
type InstallPrompt = Event & { prompt: () => Promise<unknown> };

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS se presenta como Mac

export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  // Lectura del navegador sin estado propio: en el servidor es false, así no hay diferencias de hidratación.
  const ios = useSyncExternalStore(
    () => () => {},
    () => isIos() && !isStandalone(),
    () => false,
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

  if (prompt) {
    return (
      <Alert>
        <Smartphone />
        <AlertTitle className="font-bold">
          Ponla en tu pantalla de inicio
        </AlertTitle>
        <AlertDescription>
          Ábrela como una app, sin buscarla en el navegador.
          <Button
            className="mt-3 w-full"
            onClick={() => {
              void prompt.prompt();
              setPrompt(null);
            }}
          >
            Instalar topochito
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (ios) {
    return (
      <Alert>
        <Smartphone />
        <AlertTitle className="font-bold">
          Ponla en tu pantalla de inicio
        </AlertTitle>
        <AlertDescription>
          En Safari toca{" "}
          <Share className="inline size-4" aria-label="Compartir" /> y luego
          «Añadir a pantalla de inicio».
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
