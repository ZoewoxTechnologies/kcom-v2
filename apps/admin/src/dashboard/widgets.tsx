import { Children } from "react";
import type { ReactNode } from "react";

/** Big-number tile: a label, one value and a short note under it. */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="kc-stat">
      <span className="kc-stat__label">{label}</span>
      <span className="kc-stat__value">{value}</span>
      {note && <span className="kc-stat__note">{note}</span>}
    </div>
  );
}

/** Titled card holding a list of rows; shows `empty` when there are none. */
export function Panel({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="kc-panel">
      <h2>{title}</h2>
      {Children.toArray(children).length > 0 ? (
        children
      ) : (
        <p className="kc-panel__empty">{empty}</p>
      )}
    </section>
  );
}

/** One panel row: a muted lead, the main text and an optional trailing badge. */
export function PanelRow({
  lead,
  children,
  trail,
}: {
  lead: ReactNode;
  children: ReactNode;
  trail?: ReactNode;
}) {
  return (
    <div className="kc-panel__row">
      <span className="kc-panel__lead">{lead}</span>
      <span className="kc-panel__main">{children}</span>
      {trail}
    </div>
  );
}
