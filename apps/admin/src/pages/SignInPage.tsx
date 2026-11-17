import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Button, TextField } from "@kcom/ui";
import { useAuth } from "../auth/AuthProvider";

const messages = {
  invalid: "The email or password is incorrect. Please try again.",
  "rate-limited": "Too many attempts. Please wait a few minutes and try again.",
  error: "We couldn’t reach the server. Please try again.",
} as const;

export function SignInPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "signed-in") return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await signIn(String(data.get("email")), String(data.get("password")));
    setBusy(false);
    if (result.ok) navigate(from, { replace: true });
    else setError(messages[result.reason]);
  }

  return (
    <div className="kc-admin-signin">
      <form className="kc-admin-signin__card" onSubmit={onSubmit}>
        <div className="kc-admin-signin__head">
          <img src="/logo.png" alt="" width="64" height="64" />
          <span className="kc-admin-signin__org">
            Kingdom Capstone
            <br />
            Outreach Ministries
          </span>
          <h1>Sign in to manage the site</h1>
        </div>
        {error && (
          <div role="alert" className="kc-admin-signin__error">
            {error}
          </div>
        )}
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" size="lg" loading={busy}>
          Sign in
        </Button>
        <Link to="/forgot-password" className="kc-admin-signin__forgot">
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
