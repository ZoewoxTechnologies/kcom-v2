import { Hono } from "hono";
import type { Auth } from "../auth.js";
import { CLIENT_IP_HEADER, DEFAULT_TRUSTED_PROXY_HOPS, requestClientIp } from "../client-ip.js";
import { errorBody } from "../errors.js";

/**
 * Mounts Better Auth, rewriting its error bodies into the API's error shape.
 * Headers (Set-Cookie, Retry-After) pass through untouched.
 */
export function authRoutes(auth: Auth, trustedProxyHops = DEFAULT_TRUSTED_PROXY_HOPS) {
  return new Hono().all("/*", async (c) => {
    // Better Auth keys its rate limiter on this header, so set it from the trusted hop only.
    const headers = new Headers(c.req.raw.headers);
    headers.delete(CLIENT_IP_HEADER);
    const ip = requestClientIp(c, trustedProxyHops);
    if (ip) headers.set(CLIENT_IP_HEADER, ip);
    const res = await auth.handler(new Request(c.req.raw, { headers }));
    c.header("Cache-Control", "no-store");
    if (res.status < 400 || !res.headers.get("content-type")?.includes("json")) return res;
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    const outHeaders = new Headers(res.headers);
    outHeaders.set("content-type", "application/json");
    outHeaders.delete("content-length");
    return new Response(
      JSON.stringify(
        errorBody((body?.code ?? "auth_error").toLowerCase(), body?.message ?? "request failed"),
      ),
      { status: res.status, headers: outHeaders },
    );
  });
}
