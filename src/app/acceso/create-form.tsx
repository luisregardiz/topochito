"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const name = String(new FormData(e.currentTarget).get("name") ?? "");
    const res = await fetch("/api/households", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setError(
      res.status === 429
        ? "Ya se crearon varios recetarios desde esta conexión. Intenta más tarde."
        : res.status === 403
          ? "Por ahora no se están creando recetarios nuevos."
          : "No se pudo crear el recetario. Revisa el nombre e inténtalo de nuevo.",
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-semibold">Crear mi recetario</h2>
      <label htmlFor="name" className="text-base">
        Tu nombre o el de tu familia
      </label>
      <input
        id="name"
        name="name"
        required
        maxLength={80}
        autoComplete="off"
        placeholder="Ej. Familia Pérez"
        className="h-12 rounded-lg border border-zinc-400 bg-transparent px-3 text-lg"
      />
      {error && (
        <p role="alert" className="text-base text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 text-base">
        Crear mi recetario
      </Button>
    </form>
  );
}
