import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Patrón de las pantallas de sistema: icono de 40px en caja de 80px, título, texto y 1–2 botones.
export function EmptyState({
  icon: Icon,
  title,
  body,
  tone = "neutral",
  as: Heading = "h1",
  children,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  tone?: "neutral" | "danger";
  as?: "h1" | "h2";
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
      <div
        className={cn(
          "flex size-20 items-center justify-center rounded-md",
          tone === "danger"
            ? "bg-accent text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-10" aria-hidden />
      </div>
      <Heading className="text-[26px] leading-tight font-bold xl:text-2xl">
        {title}
      </Heading>
      {body && <p className="text-lg xl:text-base">{body}</p>}
      {children && (
        <div className="flex w-full flex-col gap-3 pt-2">{children}</div>
      )}
    </div>
  );
}
