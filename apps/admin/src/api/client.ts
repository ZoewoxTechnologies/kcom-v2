/** A failed API call; `code` is the API's error code, such as "conflict". */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const apiBaseUrl = () =>
  (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Credentialed JSON request to the API. Returns the raw response, whatever its status. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl()}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

/** Like apiFetch, but parses the JSON body and throws ApiError on a non-2xx status. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    throw new ApiError(
      body?.error?.message ?? "request failed",
      res.status,
      body?.error?.code,
      body?.error?.details,
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
