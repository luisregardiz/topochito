"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function join() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.replace("/"); // ya dentro, la URL no lleva el código
      router.refresh();
      return;
    }
    setPending(false);
    setError(
      res.status === 429
        ? "Demasiados intentos. Espera unos minutos."
        : "No se pudo entrar. Inténtalo de nuevo.",
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="text-base text-red-600">
          {error}
        </p>
      )}
      <Button onClick={join} disabled={pending} className="h-12 text-base">
        Entrar al recetario
      </Button>
    </>
  );
}
