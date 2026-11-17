import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./AuthProvider";
import type { Role } from "./api";
import { ForbiddenPage } from "../pages/ForbiddenPage";

/** Sends visitors without a session to /sign-in, remembering where they were headed. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <p className="kc-admin-loading">Loading…</p>;
  if (status === "signed-out") {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Shows the friendly 403 page unless the user's role is allowed. */
export function RequireRole({ roles }: { roles: readonly Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}
