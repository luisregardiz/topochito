// navigator.clipboard solo existe en HTTPS/localhost; en http://<IP-de-red> se usa el respaldo.
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.append(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}
