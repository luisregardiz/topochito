import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  init?: ResponseInit,
) {
  return Response.json({ error: { code, message } }, { ...init, status });
}

// Respuesta uniforme de error: nunca stack traces ni mensajes de la base de datos.
export function handle<A extends unknown[]>(
  fn: (req: Request, ...args: A) => Promise<Response>,
) {
  return async (req: Request, ...args: A) => {
    try {
      return await fn(req, ...args);
    } catch (e) {
      unstable_rethrow(e); // señales internas de Next (prerender, redirect...): no son errores nuestros
      if (e instanceof HttpError)
        return errorResponse(e.status, e.code, e.message);
      if (e instanceof z.ZodError)
        return errorResponse(400, "invalid_input", "Datos inválidos");
      console.error("[api] error no controlado", e);
      return errorResponse(500, "internal_error", "Error interno");
    }
  };
}

// Lee el body como JSON con límite de tamaño y lo valida con Zod.
export async function parseJson<S extends z.ZodType>(
  req: Request,
  schema: S,
  maxBytes = 1024,
) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes)
    throw new HttpError(413, "payload_too_large", "Solicitud demasiado grande");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, "payload_too_large", "Solicitud demasiado grande");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "JSON inválido");
  }
  return schema.parse(raw) as z.infer<S>;
}
