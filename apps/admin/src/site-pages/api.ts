import { apiJson } from "../api/client";

export type PageStatus = "draft" | "scheduled" | "published";

export interface PageRecord {
  id: string;
  title: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  status: PageStatus;
  publishAt: string | null;
}

export interface PageFields {
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  status: PageStatus;
}

/** One block of a page: its kind and that kind's props. */
export interface SectionData {
  type: string;
  props: Record<string, unknown>;
}

const call = <T>(path: string, init?: RequestInit) => apiJson<T>(`/admin/pages${path}`, init);

/** The page with this slug, or null when it hasn't been created yet. */
export async function findPage(slug: string): Promise<PageRecord | null> {
  const { items } = await call<{ items: PageRecord[] }>("?limit=100");
  return items.find((p) => p.slug === slug) ?? null;
}

export const createPage = (slug: string, fields: PageFields) =>
  call<PageRecord>("", { method: "POST", body: JSON.stringify({ slug, ...fields }) });

export const updatePage = (id: string, fields: PageFields) =>
  call<PageRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify(fields) });

export const fetchSections = async (id: string) =>
  (await call<{ sections: SectionData[] }>(`/${id}/sections`)).sections;

export const saveSections = async (id: string, sections: SectionData[]) =>
  (
    await call<{ sections: SectionData[] }>(`/${id}/sections`, {
      method: "PUT",
      body: JSON.stringify({ sections }),
    })
  ).sections;
