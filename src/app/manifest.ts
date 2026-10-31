import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "topochito",
    short_name: "topochito",
    description: "Recetas y menú semanal para la alimentación complementaria",
    start_url: "/hoy", // sin sesión, proxy.ts lo envía a /acceso
    scope: "/",
    display: "standalone",
    lang: "es",
    background_color: "#fafafa",
    theme_color: "#2f7d4f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
