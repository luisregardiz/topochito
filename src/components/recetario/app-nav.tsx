"use client";

import { Baby, BookOpen, CalendarDays, House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/menu", label: "Menú", icon: CalendarDays },
  { href: "/recetas", label: "Recetas", icon: BookOpen },
  { href: "/bebe", label: "Bebé", icon: Baby },
  { href: "/recetario", label: "Mi recetario", icon: House },
] as const;

// Una sola navegación en tres formas: barra inferior (móvil), superior (tablet) y lateral (escritorio).
export function AppNav({ familyName }: { familyName: string }) {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[76px] border-t bg-card md:hidden"
      >
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-base font-bold text-muted-foreground",
              active(href) && "text-primary",
            )}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <nav
        aria-label="Principal"
        className="sticky top-0 z-40 hidden border-b bg-card md:block xl:hidden"
      >
        <div className="mx-auto flex max-w-3xl">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cn(
                "flex h-16 w-48 items-center justify-center gap-2 border-b-4 border-transparent font-bold text-muted-foreground",
                active(href) && "border-primary text-primary",
              )}
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <nav
        aria-label="Principal"
        className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r bg-card p-4 xl:flex"
      >
        <p className="font-display text-3xl leading-none">
          Recetario<span className="text-primary">.</span>
        </p>
        <p className="mb-4 truncate text-sm text-muted-foreground">
          {familyName}
        </p>
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-[15px] font-medium text-muted-foreground hover:bg-secondary/60",
              active(href) && "bg-secondary font-bold text-primary",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
