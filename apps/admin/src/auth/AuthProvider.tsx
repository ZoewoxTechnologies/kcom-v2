import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as api from "./api";
import type { SessionUser, SignInResult } from "./api";

export type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthValue {
  status: AuthStatus;
  user: SessionUser | null;
  signIn(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Holds the API session. Components read it with useAuth. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const next = await api.getSession();
      setUser(next);
      setStatus(next ? "signed-in" : "signed-out");
    } catch {
      setUser(null);
      setStatus("signed-out");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      async signIn(email, password) {
        const result = await api.signIn(email, password);
        if (result.ok) await refresh();
        return result;
      },
      async signOut() {
        await api.signOut().catch(() => undefined);
        setUser(null);
        setStatus("signed-out");
      },
    }),
    [status, user, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
