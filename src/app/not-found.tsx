import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/recetario/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center p-5">
      <EmptyState
        icon={MapPinOff}
        title="No encontramos esa página"
        body="Puede que el enlace esté mal escrito o que la página ya no exista."
      >
        <Link
          href="/menu"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Volver al menú
        </Link>
      </EmptyState>
    </main>
  );
}
