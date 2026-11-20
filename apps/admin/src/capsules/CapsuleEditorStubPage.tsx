import { Link, useParams } from "react-router";

/** Stand-in for the capsule editor route; the editor replaces this page. */
export function CapsuleEditorStubPage() {
  const { id } = useParams();
  return (
    <section className="kc-admin-notice">
      <h1>Capsule editor</h1>
      <p>The editor for capsule {id} is coming soon.</p>
      <Link to="/capsules">Back to capsules</Link>
    </section>
  );
}
