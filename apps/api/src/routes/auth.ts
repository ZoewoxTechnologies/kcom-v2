import { Hono } from "hono";
import type { Auth } from "../auth.js";
import { errorBody } from "../errors.js";

/**
 * Mounts Better Auth, rewriting its error bodies into the API's error shape.
 * Headers (Set-Cookie, Retry-After) pass through untouched.
 */
export function authRoutes(auth: Auth) {
  return new Hono().all("/*", async (c) => {
    const res = await auth.handler(c.req.raw);
    c.header("Cache-Control", "no-store");
    if (res.status < 400 || !res.headers.get("content-type")?.includes("json")) return res;
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    const headers = new Headers(res.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    return new Response(
      JSON.stringify(
        errorBody((body?.code ?? "auth_error").toLowerCase(), body?.message ?? "request failed"),
      ),
      { status: res.status, headers },
    );
  });
}
