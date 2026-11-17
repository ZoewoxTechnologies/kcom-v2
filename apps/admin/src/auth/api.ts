export type Role = "admin" | "editor";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const baseUrl = () => (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl()}/api/auth${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

/** The signed-in user, or null when there is no valid session. */
export async function getSession(): Promise<SessionUser | null> {
  const res = await call("/get-session");
  if (!res.ok) throw new Error("session request failed");
  const body = (await res.json()) as { user?: SessionUser } | null;
  return body?.user ?? null;
}

export type SignInResult =
  { ok: true } | { ok: false; reason: "invalid" | "rate-limited" | "error" };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  let res: Response;
  try {
    res = await call("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, reason: "error" };
  }
  if (res.ok) return { ok: true };
  if (res.status === 429) return { ok: false, reason: "rate-limited" };
  return { ok: false, reason: res.status >= 500 ? "error" : "invalid" };
}

export async function signOut(): Promise<void> {
  await call("/sign-out", { method: "POST", body: "{}" });
}
