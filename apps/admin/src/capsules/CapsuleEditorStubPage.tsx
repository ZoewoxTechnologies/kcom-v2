import { Link, useParams, useSearchParams } from "react-router";

/**
 * Stand-in for the capsule editor routes; the editor replaces it. Pass `isNew`
 * on `/capsules/new`, which has no `:id`.
 */
export function CapsuleEditorStubPage({ isNew = false }: { isNew?: boolean }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const day = params.get("day");
  return (
    <section className="kc-admin-notice">
      <h1>{isNew ? "New capsule" : "Capsule editor"}</h1>
      <p>
        {isNew
          ? `The editor for a new capsule${day ? ` on ${day}` : ""} is coming soon.`
          : `The editor for capsule ${id} is coming soon.`}
      </p>
      <Link to="/capsules">Back to capsules</Link>
    </section>
  );
}
