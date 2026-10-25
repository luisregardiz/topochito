"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareButton({ code, name }: { code: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/join/${encodeURIComponent(code)}`;
    const text = `Entra al recetario de bebé de ${name}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Recetario para bebés", text, url });
      } catch {
        // el usuario cerró el menú de compartir
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <Button onClick={share} className="h-12 text-base">
      {copied ? "¡Enlace copiado!" : "Compartir mi recetario"}
    </Button>
  );
}
