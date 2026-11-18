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

/**
 * Every DataSource method name; wrappers are built from this. Listing a name that does not exist
 * or leaving one out is a compile error, so adding a method is a one-line change here.
 */
export const dataMethods = ["latestCapsule"] as const satisfies readonly (keyof DataSource)[];

type MissingMethods = Exclude<keyof DataSource, (typeof dataMethods)[number]>;
/** Fails to compile (type `never` is not `true`) when a DataSource method is missing from `dataMethods`. */
export const dataMethodsComplete: [MissingMethods] extends [never] ? true : never = true;
