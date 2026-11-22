import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Banner, Button } from "@kcom/ui";

type State<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

/**
 * Runs `load` on mount and whenever `retry` is called, and renders by state. It knows nothing about
 * what it loads or where it sits, so any panel, tile or section can use it and a failure stays in
 * the place that asked. `load` must be stable (wrap it in useCallback) or it will refetch each render.
 */
export function Async<T>({
  load,
  loading,
  error,
  children,
}: {
  load: () => Promise<T>;
  loading: ReactNode;
  error: (retry: () => void) => ReactNode;
  children: (data: T) => ReactNode;
}) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let current = true;
    load().then(
      (data) => current && setState({ status: "ready", data }),
      () => current && setState({ status: "error" }),
    );
    return () => {
      current = false;
    };
  }, [load, attempt]);

  if (state.status === "loading") return <>{loading}</>;
  if (state.status === "error") return <>{error(retry)}</>;
  return <>{children(state.data)}</>;
}

/** A titled card that loads its own data: shows "Loading…" or an error with Try again in place. */
export function AsyncPanel<T>({
  title,
  load,
  children,
}: {
  title: string;
  load: () => Promise<T>;
  /** Renders the loaded card (typically a `Panel`). */
  children: (data: T) => ReactNode;
}) {
  const shell = (body: ReactNode) => (
    <section className="kc-panel">
      <h2>{title}</h2>
      {body}
    </section>
  );
  return (
    <Async
      load={load}
      loading={shell(<p className="kc-panel__empty">Loading…</p>)}
      error={(retry) =>
        shell(
          <Banner
            variant="danger"
            action={
              <Button variant="tertiary" onClick={retry}>
                Try again
              </Button>
            }
          >
            {title} could not be loaded.
          </Banner>,
        )
      }
    >
      {children}
    </Async>
  );
}

/** A stat tile that loads its own number: a label with "…" or a short error and Try again. */
export function AsyncTile<T>({
  label,
  load,
  children,
  after,
}: {
  label: string;
  load: () => Promise<T>;
  /** Renders the inside of the loaded tile. */
  children: (data: T) => ReactNode;
  /** Renders next to the loaded tile, outside it (for example a notice spanning the row). */
  after?: (data: T) => ReactNode;
}) {
  const shell = (body: ReactNode) => (
    <div className="kc-stat">
      <span className="kc-stat__label">{label}</span>
      {body}
    </div>
  );
  return (
    <Async
      load={load}
      loading={shell(<span className="kc-stat__value">…</span>)}
      error={(retry) =>
        shell(
          <>
            <span role="alert" className="kc-stat__error">
              Could not be loaded.
            </span>
            <Button variant="tertiary" onClick={retry}>
              Try again
            </Button>
          </>,
        )
      }
    >
      {(data) => (
        <>
          {shell(children(data))}
          {after?.(data)}
        </>
      )}
    </Async>
  );
}
