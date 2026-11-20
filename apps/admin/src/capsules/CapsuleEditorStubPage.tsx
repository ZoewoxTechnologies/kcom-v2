import { Link, useParams, useSearchParams } from "react-router";

/** Stand-in for the capsule editor routes (`/capsules/:id`, `/capsules/new`); the editor replaces it. */
export function CapsuleEditorStubPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const day = params.get("day");
  return (
    <section className="kc-admin-notice">
      <h1>{id === "new" ? "New capsule" : "Capsule editor"}</h1>
      <p>
        {id === "new"
          ? `The editor for a new capsule${day ? ` on ${day}` : ""} is coming soon.`
          : `The editor for capsule ${id} is coming soon.`}
      </p>
      <Link to="/capsules">Back to capsules</Link>
    </section>
  );
}
