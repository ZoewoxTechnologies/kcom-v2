import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { CapsuleEditorStubPage } from "./CapsuleEditorStubPage";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="capsules/new" element={<CapsuleEditorStubPage isNew />} />
        <Route path="capsules/:id" element={<CapsuleEditorStubPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("capsule editor stub", () => {
  it("names the day on the new-capsule route", () => {
    renderAt("/capsules/new?day=2026-11-24");
    expect(screen.getByRole("heading", { name: "New capsule" })).toBeInTheDocument();
    expect(screen.getByText(/new capsule on 2026-11-24/)).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("names the capsule on the edit route", () => {
    renderAt("/capsules/abc");
    expect(screen.getByText(/capsule abc/)).toBeInTheDocument();
  });
});
