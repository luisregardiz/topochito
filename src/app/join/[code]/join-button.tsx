"use client";

import { clearPrivateCaches } from "@/components/service-worker";
import { Clock, LoaderCircle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function JoinButton({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [limited, setLimited] = useState(false);
  const [failed, setFailed] = useState(false);

  async function join() {
    setPending(true);
    setLimited(false);
    setFailed(false);
    try {
      await api.post("/access", { code });
      await clearPrivateCaches();
      toast.success(`Entraste al recetario de ${name}`);
      router.replace("/hoy"); // ya dentro, la URL no lleva el código
      router.refresh();
    } catch (e) {
      setPending(false);
      if (e instanceof ApiError && e.status === 429) setLimited(true);
      else setFailed(true);
    }
  }

  return (
    <>
      {limited && (
        <Alert variant="destructive">
          <Clock />
          <AlertTitle className="font-bold">
            Demasiados intentos. Espera unos minutos.
          </AlertTitle>
        </Alert>
      )}
      {failed && (
        <Alert variant="destructive">
          <AlertTitle className="font-bold">
            No se pudo entrar. Inténtalo de nuevo.
          </AlertTitle>
        </Alert>
      )}
      <Button size="lg" className="w-full" onClick={join} disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden /> Entrando…
          </>
        ) : (
          <>
            {limited && <Lock aria-hidden />}
            Entrar al recetario
          </>
        )}
      </Button>
    </>
  );
}
