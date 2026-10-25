import { Baby } from "lucide-react";
import { EmptyState } from "@/components/recetario/empty-state";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl p-5 md:p-8">
      <EmptyState
        icon={Baby}
        title="Mi bebé"
        body="Esta sección está en preparación."
      />
    </main>
  );
}
