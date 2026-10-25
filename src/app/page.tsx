import { redirect } from "next/navigation";

// Sin sesión, proxy.ts ya envía a /acceso; con sesión se llega aquí.
export default function Home() {
  redirect("/menu");
}
