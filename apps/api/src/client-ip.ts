import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/** Header the API sets for Better Auth's rate limiter; always overwritten, never taken from the client. */
export const CLIENT_IP_HEADER = "x-kcom-client-ip";

/** TRUSTED_PROXY_HOPS must be a positive integer; anything else falls back to the default with a warning. */
export function parseTrustedProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TRUSTED_PROXY_HOPS;
  if (/^[1-9]\d*$/.test(raw.trim())) return Number(raw.trim());
  console.warn(`[client-ip] invalid TRUSTED_PROXY_HOPS "${raw}"; using ${DEFAULT_TRUSTED_PROXY_HOPS}`);
  return DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * Client IP from the RIGHT of x-forwarded-for: each trusted proxy appends the address it saw, so the entry
 * `hops` from the end is the one our own proxy recorded; anything to its left is client-supplied and ignored.
 * Falls back to the socket address, and is undefined when neither is usable (never a shared bucket).
 */
export function clientIp(header: string | undefined, hops: number, socketAddress?: string): string | undefined {
  const parts = (header ?? "").split(",").map((p) => p.trim());
  const fromHeader = hops >= 1 ? parts[parts.length - hops] : undefined;
  return fromHeader || socketAddress || undefined;
}

/** clientIp for a Hono request, reading the socket address when there is one. */
export function requestClientIp(c: Context, hops: number): string | undefined {
  let socketAddress: string | undefined;
  try {
    socketAddress = getConnInfo(c).remote.address;
  } catch {
    // No Node socket (e.g. in-process requests); fall through.
  }
  return clientIp(c.req.header("x-forwarded-for"), hops, socketAddress);
}
