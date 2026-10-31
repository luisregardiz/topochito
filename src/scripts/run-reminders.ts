// Uso (desarrollo): pnpm reminders:run [url]. Dispara una vez el cron de recordatorios de la app local.
// Sin claves de QStash, el endpoint acepta en desarrollo el Bearer CRON_SECRET; en producción solo QStash.
async function main() {
  const base = process.argv[2] ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Falta CRON_SECRET");
  const res = await fetch(new URL("/api/cron/reminders", base), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.log(res.status, await res.text());
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
