/** What the public pages need from a capsule; picked from the API's response. */
export interface CapsuleSummary {
  slug: string;
  title: string;
  /** Calendar day in Africa/Lagos, YYYY-MM-DD. */
  displayDate: string;
  scriptureRef: string | null;
  scriptureText: string | null;
}

export interface DataSource {
  latestCapsule(): Promise<CapsuleSummary | null>;
}

/** Every DataSource method name; wrappers are built from this, so a new method is a one-line addition here. */
export const dataMethods = ["latestCapsule"] as const satisfies readonly (keyof DataSource)[];
