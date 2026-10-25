"use client";

import { ServerCrash } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/recetario/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center p-5">
      <EmptyState
        icon={ServerCrash}
        tone="danger"
        title="Algo salió mal. Inténtalo de nuevo"
        body="No es culpa tuya. Si vuelve a pasar, espera un rato y abre la página otra vez."
      >
        <Button size="lg" className="w-full" onClick={reset}>
          Intentar de nuevo
        </Button>
        <Link
          href="/menu"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full",
          )}
        >
          Volver al menú
        </Link>
      </EmptyState>
    </main>
  );
}
