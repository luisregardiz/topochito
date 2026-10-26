import type { Metadata } from "next";
import { DM_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { OfflineBanner } from "@/components/recetario/offline-banner";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Texto: IBM Plex Sans. Títulos: Space Grotesk. Códigos de familia: DM Mono.
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Recetario",
  description: "Recetas y menú semanal para la alimentación complementaria",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${plex.variable} ${grotesk.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <OfflineBanner />
        <Toaster />
      </body>
    </html>
  );
}
