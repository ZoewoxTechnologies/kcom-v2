import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDirtyState } from "./useDirtyState";

describe("useDirtyState", () => {
  it("is dirty only while the value differs from the baseline", () => {
    const { result } = renderHook(() => useDirtyState({ a: 1 }));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValue({ a: 2 }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.setValue({ a: 1 }));
    expect(result.current.dirty).toBe(false);
  });

  it("markSaved moves the baseline and reset restores it", () => {
    const { result } = renderHook(() => useDirtyState({ a: 1 }));
    act(() => result.current.setValue({ a: 2 }));
    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValue({ a: 3 }));
    act(() => result.current.reset());
    expect(result.current.value).toEqual({ a: 2 });
    expect(result.current.dirty).toBe(false);
  });

  it("markSaved then reset in the same tick keeps the saved value", () => {
    const { result } = renderHook(() => useDirtyState({ a: 1 }));
    act(() => {
      result.current.setValue({ a: 2 });
      result.current.markSaved();
      result.current.reset();
    });
    expect(result.current.value).toEqual({ a: 2 });
    expect(result.current.dirty).toBe(false);
  });
});
