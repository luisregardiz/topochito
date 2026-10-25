import axios from "axios";

// Error normalizado: nuestra API siempre responde { error: { code, message } }.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const api = axios.create({ baseURL: "/api", timeout: 15_000 });

api.interceptors.response.use(undefined, (error: unknown) => {
  if (!axios.isAxiosError(error)) throw error;
  if (axios.isCancel(error)) throw error;
  const body = error.response?.data as
    { error?: { code?: string; message?: string } } | undefined;
  throw new ApiError(
    error.response?.status ?? 0,
    body?.error?.code ?? (error.response ? "http_error" : "network_error"),
    body?.error?.message ?? error.message,
  );
});
