"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Vuelve a la página de origen (Recetas o Mi recetario); si se abrió el enlace directo, va a `fallback`.
export function BackButton({
  fallback,
  children,
}: {
  fallback: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="lg"
      className="-ml-3 w-fit"
      onClick={() =>
        window.history.length > 1 ? router.back() : router.push(fallback)
      }
    >
      <ChevronLeft aria-hidden /> {children}
    </Button>
  );
}
