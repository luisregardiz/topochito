"use client";

import {
  Apple,
  CookingPot,
  Moon,
  Play,
  Sun,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MealType } from "@/modules/recipes/recipes.schemas";
import { cn } from "@/lib/utils";

export const MEALS: Record<
  MealType,
  { label: string; icon: LucideIcon; tint: string }
> = {
  desayuno: { label: "Desayuno", icon: Sunrise, tint: "bg-meal-desayuno" },
  almuerzo: { label: "Almuerzo", icon: Sun, tint: "bg-meal-almuerzo" },
  merienda: { label: "Merienda", icon: Apple, tint: "bg-meal-merienda" },
  cena: { label: "Cena", icon: Moon, tint: "bg-meal-cena" },
  base: { label: "Preparación base", icon: CookingPot, tint: "bg-meal-base" },
};

// Foto de Cloudinary con respaldo: sin URL, o si la imagen falla, se ve el placeholder de la comida (nunca un hueco).
// <img> y no next/image: Cloudinary ya recorta y optimiza, y así no se gasta el optimizador de Vercel.
function Photo({
  src,
  alt,
  className,
  eager,
}: {
  src: string;
  alt: string;
  className: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary ya optimiza y redimensiona
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function usePhoto(src: string | null | undefined) {
  const [failed, setFailed] = useState(false);
  return { show: !!src && !failed, onError: () => setFailed(true) };
}

// Miniatura cuadrada de 88 px.
export function MealThumb({
  meal,
  src,
  className,
}: {
  meal: MealType;
  src?: string | null;
  className?: string;
}) {
  const { icon: Icon, tint } = MEALS[meal];
  const photo = usePhoto(src);
  return (
    <div
      className={cn(
        "relative size-[88px] shrink-0 overflow-hidden rounded-md",
        tint,
        className,
      )}
      aria-hidden
    >
      {photo.show ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary ya optimiza y redimensiona
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={photo.onError}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Icon className="size-8 text-foreground/70" />
        </div>
      )}
    </div>
  );
}

// Imagen principal 4:3: lo primero que se ve en el detalle, por eso se carga con prioridad.
export function RecipeImage({
  meal,
  src,
  alt,
}: {
  meal: MealType;
  src?: string | null;
  alt: string;
}) {
  const { icon: Icon, tint, label } = MEALS[meal];
  const photo = usePhoto(src);
  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-md",
        tint,
      )}
    >
      {photo.show ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary ya optimiza y redimensiona
        <img
          src={src!}
          alt={alt}
          fetchPriority="high"
          decoding="async"
          onError={photo.onError}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2">
          <Icon className="size-12 text-foreground/70" aria-hidden />
          <span className="text-base font-bold text-foreground/70">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

// Video 16:9. No descarga nada hasta que se pulsa «Reproducir video» (solo se carga el póster).
export function RecipeVideo({
  video,
  title,
}: {
  video: { src: string; poster: string };
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
      {playing ? (
        <video
          src={video.src}
          poster={video.poster}
          aria-label={`Video de la preparación: ${title}`}
          controls
          autoPlay
          playsInline
          preload="none"
          className="size-full bg-black"
        />
      ) : (
        <>
          <Photo src={video.poster} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Button size="lg" onClick={() => setPlaying(true)}>
              <Play aria-hidden /> Reproducir video
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
