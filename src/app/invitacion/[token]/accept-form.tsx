"use client";

import { clearPrivateCaches } from "@/components/service-worker";
import { Clock, LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";

export function AcceptForm({ token, name }: { token: string; name: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setProblem("Escribe quién eres.");
    setPending(true);
    setProblem(null);
    try {
      await api.post(`/invitations/${token}`, { label });
      await clearPrivateCaches();
      toast.success(`Entraste al recetario de ${name}`);
      router.replace("/hoy"); // ya dentro, la URL no lleva el token
      router.refresh();
    } catch (e) {
      setPending(false);
      const err = e instanceof ApiError ? e : null;
      setProblem(
        err?.status === 429
          ? "Demasiados intentos. Espera un rato e inténtalo otra vez."
          : err && err.status < 500
            ? err.message
            : "No pudimos unirte. Revisa tu conexión e inténtalo de nuevo.",
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="etiqueta" className="text-base font-bold">
          ¿Quién eres?
        </Label>
        <Input
          id="etiqueta"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej.: Abuela, Niñera"
          maxLength={40}
          autoComplete="off"
        />
        <p className="text-base text-muted-foreground">
          Así te verá la familia en la lista de cuidadores.
        </p>
      </div>
      {problem && (
        <Alert variant="destructive">
          {problem.startsWith("Demasiados") ? <Clock /> : <TriangleAlert />}
          <AlertTitle className="font-bold">{problem}</AlertTitle>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden /> Entrando…
          </>
        ) : (
          `Unirme a ${name}`
        )}
      </Button>
    </form>
  );
}
