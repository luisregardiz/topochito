"use client";

import { Copy, LogOut, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";

export function RecetarioActions({ code }: { code: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function share() {
    await copyText(
      `${window.location.origin}/join/${encodeURIComponent(code)}`,
    );
    toast.success("¡Enlace copiado!", {
      description: "Pégalo en WhatsApp o en un mensaje.",
    });
  }

  async function copyCode() {
    await copyText(code);
    toast.success("Código copiado");
  }

  async function leave() {
    setLeaving(true);
    await api.post("/access/logout");
    router.replace("/acceso");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button size="lg" className="w-full" onClick={share}>
          <Share2 aria-hidden /> Compartir recetario
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={copyCode}
        >
          <Copy aria-hidden /> Copiar código
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full"
        onClick={() => setConfirmOpen(true)}
      >
        <LogOut aria-hidden /> Salir
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="p-5 text-base sm:max-w-[480px]"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-[26px] leading-tight font-bold">
              ¿Salir del recetario?
            </DialogTitle>
            <DialogDescription className="text-lg text-foreground xl:text-base">
              Para volver a entrar vas a necesitar el código. Anótalo o
              compártelo antes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => setConfirmOpen(false)}
            >
              Quedarme
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="w-full"
              disabled={leaving}
              onClick={leave}
            >
              Salir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
