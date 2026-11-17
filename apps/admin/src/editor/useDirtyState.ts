import { useCallback, useRef, useState } from "react";

const jsonEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface DirtyState<T> {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  /** True while the value differs from the last saved (or initial) value. */
  dirty: boolean;
  /** Treat the current value as saved, or replace the baseline with `next`. */
  markSaved: (next?: T) => void;
  /** Throw away edits and go back to the saved value. */
  reset: () => void;
}

/** Tracks an editor's value against its saved baseline. Pass `isEqual` for values JSON can't compare. */
export function useDirtyState<T>(
  initial: T,
  isEqual: (a: T, b: T) => boolean = jsonEqual,
): DirtyState<T> {
  const [saved, setSaved] = useState(initial);
  const [value, setValueState] = useState(initial);
  const valueRef = useRef(value);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(valueRef.current) : next;
    valueRef.current = resolved;
    setValueState(resolved);
  }, []);

  const markSaved = useCallback((next?: T) => {
    const baseline = next === undefined ? valueRef.current : next;
    valueRef.current = baseline;
    setValueState(baseline);
    setSaved(baseline);
  }, []);

  const reset = useCallback(() => {
    valueRef.current = saved;
    setValueState(saved);
  }, [saved]);

  return { value, setValue, dirty: !isEqual(value, saved), markSaved, reset };
}
