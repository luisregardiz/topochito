import { Carrot, ChevronRight, Citrus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const GUIDES = [
  {
    href: "/guias/despensa",
    icon: Carrot,
    title: "Guía de la despensa",
    text: "21 alimentos: desde qué edad y cómo prepararlos",
  },
  {
    href: "/guias/frutas",
    icon: Citrus,
    title: "Cortes de fruta",
    text: "8 frutas, a 7–8 y a 9–11 meses",
  },
] as const;

export function GuideLinks() {
  return (
    <section aria-labelledby="guias" className="flex flex-col gap-3">
      <h2 id="guias" className="text-[22px] font-bold xl:text-xl">
        Guías
      </h2>
      <Card className="py-0">
        <CardContent className="flex flex-col divide-y px-0">
          {GUIDES.map(({ href, icon: Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted"
            >
              <Icon className="size-6 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block font-bold">{title}</span>
                <span className="block text-base text-muted-foreground">
                  {text}
                </span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
