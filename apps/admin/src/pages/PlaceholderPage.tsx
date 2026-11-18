/** Stand-in for sections that later work fills in. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="kc-admin-notice">
      <h1>{title}</h1>
      <p>This section is coming soon.</p>
    </section>
  );
}
