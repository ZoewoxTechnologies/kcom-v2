import { useAuth } from "../auth/AuthProvider";

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <section className="kc-admin-notice">
      <h1>Welcome, {user?.name}</h1>
      <p>Pick a section from the menu.</p>
    </section>
  );
}
