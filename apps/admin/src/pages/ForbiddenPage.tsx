import { Link } from "react-router";

export function ForbiddenPage() {
  return (
    <section className="kc-admin-notice">
      <h1>You don’t have access to this page</h1>
      <p>Ask an administrator if you need it.</p>
      <Link to="/">Back to the dashboard</Link>
    </section>
  );
}
