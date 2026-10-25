// Formato XXXX-XXXX del campo del código de familia (cliente y pruebas). El servidor normaliza por su cuenta.
const strip = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

export function formatFamilyCode(value: string) {
  const s = strip(value);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

export const isFamilyCodeComplete = (value: string) =>
  strip(value).length === 8;

// El guion no se escribe. Borrar justo después del guion borra también el carácter anterior.
export function nextFamilyCode(prev: string, next: string, inputType?: string) {
  if (
    inputType === "deleteContentBackward" &&
    prev.includes("-") &&
    next === prev.replace("-", "")
  ) {
    const s = strip(next);
    return formatFamilyCode(s.slice(0, 3) + s.slice(4));
  }
  return formatFamilyCode(next);
}
