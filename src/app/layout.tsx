import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Bebas_Neue, DM_Mono } from "next/font/google";
import { OfflineBanner } from "@/components/recetario/offline-banner";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
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
      className={`${atkinson.variable} ${bebas.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <OfflineBanner />
        <Toaster />
      </body>
    </html>
  );
}
