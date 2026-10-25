"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AccessForm() {
  const router = useRouter();
  const invalidLink = useSearchParams().get("error") === "codigo";
  const [error, setError] = useState<string | null>(
    invalidLink
      ? "Ese enlace o código no es válido. Pídelo de nuevo a quien te lo compartió."
      : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setError(
      res.status === 429
        ? "Demasiados intentos. Espera unos minutos."
        : res.status === 401
          ? "Código incorrecto."
          : "No se pudo verificar el código.",
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-semibold">Acceder al recetario de mi bebé</h2>
      <label htmlFor="code" className="text-base">
        Escribe el código que te compartieron
      </label>
      <input
        id="code"
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        required
        maxLength={64}
        placeholder="XXXX-XXXX"
        className="h-12 rounded-lg border border-zinc-400 bg-transparent px-3 text-lg tracking-widest"
      />
      {error && (
        <p role="alert" className="text-base text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 text-base">
        Entrar
      </Button>
    </form>
  );
}
