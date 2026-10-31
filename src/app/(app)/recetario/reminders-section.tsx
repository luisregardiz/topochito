"use client";

import {
  BellOff,
  BellRing,
  CalendarPlus,
  Copy,
  LoaderCircle,
  Smartphone,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { IosInstallGuide } from "@/components/recetario/install-hint";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";
import { isIos, isStandalone } from "@/lib/platform";
import { cn } from "@/lib/utils";
import {
  useCalendar,
  useMyPrefs,
  useNewCalendarLink,
  usePushKey,
  useSaveCalendarAlarm,
  useSaveLead,
} from "@/modules/reminders/reminders.queries";

const LEAD_ITEMS = [
  { value: "0", label: "A la hora" },
  { value: "15", label: "15 min antes" },
];

function LeadPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      id={id}
      variant="outline"
      value={[String(value)]}
      onValueChange={(v) => v[0] && onChange(Number(v[0]))}
      className="w-full"
      disabled={disabled}
    >
      {LEAD_ITEMS.map((i) => (
        <ToggleGroupItem
          key={i.value}
          value={i.value}
          className="h-12 flex-1 text-base font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {i.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function RemindersSection() {
  return (
    <section aria-labelledby="recordatorios" className="flex flex-col gap-3">
      <h2 id="recordatorios" className="text-[22px] font-bold xl:text-xl">
        Recordatorios
      </h2>
      <CalendarCard />
      <PushCard />
    </section>
  );
}

function CalendarCard() {
  const status = useCalendar();
  const newLink = useNewCalendarLink();
  const saveAlarm = useSaveCalendarAlarm();
  const [token, setToken] = useState<string | null>(null);

  const create = () =>
    newLink.mutate(undefined, {
      onSuccess: setToken,
      onError: () => toast.error("No pudimos crear el enlace"),
    });

  const host = typeof window === "undefined" ? "" : window.location.host;
  const https = token ? `https://${host}/api/calendar/${token}.ics` : "";
  const webcal = token ? `webcal://${host}/api/calendar/${token}.ics` : "";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-bold">Recordatorios en tu calendario</h3>
          <p className="text-base text-muted-foreground">
            Las comidas del menú aparecen en el calendario de tu teléfono, con
            su aviso. Funciona aunque no abras la app.
          </p>
        </div>

        {status.isPending ? (
          <Skeleton className="h-28 w-full" />
        ) : token ? (
          <div className="flex flex-col gap-3">
            <a
              href={webcal}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              <CalendarPlus aria-hidden /> Agregar a Apple Calendar
            </a>
            <a
              href={`https://www.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "w-full",
              )}
            >
              <CalendarPlus aria-hidden /> Agregar a Google Calendar
            </a>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={async () => {
                await copyText(https);
                toast.success("¡Enlace copiado!", {
                  description:
                    "En Google Calendar: Otros calendarios → Desde URL.",
                });
              }}
            >
              <Copy aria-hidden /> Copiar link
            </Button>
            <p className="text-base text-muted-foreground">
              Este enlace solo se muestra ahora. Guárdalo si quieres agregarlo
              en otro dispositivo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {status.data?.active && (
              <p className="text-base">
                Ya hay un enlace de calendario activo. Si creas uno nuevo, el
                anterior deja de actualizarse en los calendarios donde lo
                agregaste.
              </p>
            )}
            <Button
              size="lg"
              className="w-full"
              disabled={newLink.isPending}
              onClick={create}
            >
              {newLink.isPending && (
                <LoaderCircle className="animate-spin" aria-hidden />
              )}
              {status.data?.active ? "Crear enlace nuevo" : "Crear enlace"}
            </Button>
          </div>
        )}

        {status.data && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="alarma-calendario" className="text-base font-bold">
              Aviso del calendario
            </Label>
            <LeadPicker
              id="alarma-calendario"
              value={status.data.alarmMinutes}
              disabled={saveAlarm.isPending}
              onChange={(m) => saveAlarm.mutate(m)}
            />
          </div>
        )}

        <Alert>
          <BellRing />
          <AlertDescription>
            Google Calendar puede tardar varias horas en reflejar los cambios
            del menú. En algunas apps de calendario hay que activar las
            notificaciones de ese calendario.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// «AAAA…» (base64url) → bytes, como pide pushManager.subscribe.
function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const noop = () => () => {};
const pushSupport = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window
    ? isIos() && !isStandalone()
      ? "ios-install"
      : "ok"
    : "unsupported";

function PushCard() {
  const key = usePushKey();
  const prefs = useMyPrefs();
  const saveLead = useSaveLead();
  const support = useSyncExternalStore(noop, pushSupport, () => "pending");
  const [sub, setSub] = useState<PushSubscription | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (support !== "ok") return;
    // getRegistration y no .ready: en desarrollo no hay service worker y .ready nunca resolvería.
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then(setSub, () => setSub(null));
  }, [support]);

  if (!key.data) return null; // push sin configurar en el servidor

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission(); // solo tras el toque del botón
      if (permission !== "granted") return setDenied(true);
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) throw new Error("sin service worker");
      const s = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key.data!),
      });
      await api.post("/push/subscriptions", s.toJSON());
      setSub(s);
      toast.success("Avisos activados en este teléfono");
    } catch {
      toast.error("No pudimos activar los avisos", {
        description: "Inténtalo de nuevo desde la app instalada.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!sub) return;
    setBusy(true);
    try {
      await api.delete("/push/subscriptions", {
        data: { endpoint: sub.endpoint },
      });
      await sub.unsubscribe();
      setSub(null);
      toast.success("Avisos desactivados en este teléfono");
    } catch {
      toast.error("No pudimos desactivar los avisos");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-bold">Avisos en este teléfono</h3>
          <p className="text-base text-muted-foreground">
            Una notificación a la hora de cada comida, solo en este dispositivo.
          </p>
        </div>

        {support === "unsupported" && (
          <p className="text-base">Este navegador no admite avisos.</p>
        )}
        {support === "ios-install" && (
          <Alert>
            <Smartphone />
            <AlertTitle className="font-bold">
              En iPhone, primero instala la app
            </AlertTitle>
            <AlertDescription>
              Los avisos solo funcionan con la app en la pantalla de inicio.
              <IosInstallGuide />
            </AlertDescription>
          </Alert>
        )}
        {support === "ok" && sub !== undefined && (
          <>
            {sub ? (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={disable}
              >
                <BellOff aria-hidden /> Desactivar avisos
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={enable}
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <BellRing aria-hidden />
                )}
                Activar avisos
              </Button>
            )}
            {denied && (
              <p role="alert" className="text-base font-bold text-destructive">
                Bloqueaste las notificaciones. Actívalas en los ajustes del
                navegador para este sitio y vuelve a intentarlo.
              </p>
            )}
            {prefs.data && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="anticipacion" className="text-base font-bold">
                  Cuándo avisar
                </Label>
                <LeadPicker
                  id="anticipacion"
                  value={prefs.data.pushLeadMinutes}
                  disabled={saveLead.isPending}
                  onChange={(m) => saveLead.mutate(m)}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
