"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-5 text-base sm:max-w-[480px]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-[26px] leading-tight font-bold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-lg text-foreground xl:text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            size="lg"
            variant={destructive ? "destructive" : "default"}
            className="w-full"
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
