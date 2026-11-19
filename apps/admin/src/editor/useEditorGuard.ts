import { useEffect, useRef } from "react";
import { useBlocker, type Blocker } from "react-router";

/**
 * While `active`, warns before the tab closes or reloads and blocks in-app
 * navigation. Needs a data router (createBrowserRouter / createMemoryRouter).
 * `allowNavigation()` lets the next navigation through, for after a confirmed close.
 */
export function useEditorGuard(active: boolean): { blocker: Blocker; allowNavigation: () => void } {
  const bypass = useRef(false);
  const blocker = useBlocker(() => active && !bypass.current);

  // A bypass only covers the close that set it; a new edit session starts guarded again.
  useEffect(() => {
    bypass.current = false;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need a return value to show their prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  return {
    blocker,
    allowNavigation: () => {
      bypass.current = true;
    },
  };
}
