import { WifiOff } from "lucide-react";
import { EmptyState } from "@/components/recetario/empty-state";

export const metadata = { title: "Sin conexión · topochito" };

// La sirve el service worker cuando no hay red y la página pedida no está guardada.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-5">
      <p className="font-display text-[32px] leading-tight">
        topochito<span className="text-primary">.</span>
      </p>
      <EmptyState
        icon={WifiOff}
        title="Estás sin conexión"
        body="Las recetas y el menú que ya abriste siguen disponibles. Vuelve a intentarlo cuando tengas internet."
      />
    </main>
  );
}
