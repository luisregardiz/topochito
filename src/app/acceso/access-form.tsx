"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccessForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
    <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <label htmlFor="code" className="text-sm font-medium">
        Código de familia
      </label>
      <input
        id="code"
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        required
        maxLength={64}
        className="rounded border border-zinc-400 bg-transparent px-3 py-2 tracking-widest"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
      >
        Entrar
      </button>
    </form>
  );
}
