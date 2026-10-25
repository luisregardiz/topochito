import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/recetario/empty-state";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl p-5 md:p-8">
      <EmptyState
        icon={CalendarDays}
        title="Menú de la semana"
        body="Esta sección está en preparación."
      />
    </main>
  );
}
