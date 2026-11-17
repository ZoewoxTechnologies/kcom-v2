import type { CapsuleSummary, DataSource } from "./types";

export const sampleCapsule: CapsuleSummary = {
  slug: "be-ye-transformed",
  title: "Be ye transformed",
  displayDate: "2026-11-14",
  scriptureRef: "Romans 12:2",
  scriptureText: "Be ye transformed by the renewing of your mind.",
};

export const sampleSource: DataSource = {
  latestCapsule: async () => sampleCapsule,
};
