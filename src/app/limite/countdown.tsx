"use client";

import { Hourglass } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/recetario/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Countdown({ seconds }: { seconds: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <EmptyState
      icon={Hourglass}
      tone="danger"
      title="Vamos muy rápido"
      body="Hubo demasiadas solicitudes seguidas. Espera un momento y podrás seguir."
    >
      <Progress
        value={((seconds - left) / seconds) * 100}
        aria-label="Tiempo de espera"
      />
      <Button
        size="lg"
        className="w-full"
        disabled={left > 0}
        onClick={() => router.back()}
      >
        {left > 0 ? `Volver a intentar en ${clock(left)}` : "Volver a intentar"}
      </Button>
    </EmptyState>
  );
}
