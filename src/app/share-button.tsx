"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// navigator.clipboard solo existe en HTTPS/localhost; en http://<IP-de-red> se usa el respaldo.
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.append(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

export function ShareButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    await copy(`${window.location.origin}/join/${encodeURIComponent(code)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <Button onClick={share} className="h-12 text-base">
      {copied ? "¡Enlace copiado!" : "Compartir recetario"}
    </Button>
  );
}
