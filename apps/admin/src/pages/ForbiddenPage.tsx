import { Link } from "react-router";

export function ForbiddenPage() {
  return (
    <section className="kc-admin-notice">
      <h1>You don’t have access to this page</h1>
      <p>
        This area is for administrators. If you think that’s a mistake, ask an administrator to
        update your role.
      </p>
      <Link to="/">Back to the dashboard</Link>
    </section>
  );
}
