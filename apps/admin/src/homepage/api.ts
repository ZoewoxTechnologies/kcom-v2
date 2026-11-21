import { apiJson } from "../api/client";
import type { SectionRow } from "./layout";

interface Response {
  sections: (SectionRow & { position: number })[];
}

const toRows = (r: Response): SectionRow[] =>
  [...r.sections]
    .sort((a, b) => a.position - b.position)
    .map(({ key, visible }) => ({ key, visible }));

export const fetchLayout = async () => toRows(await apiJson<Response>("/admin/homepage"));

export const saveLayout = async (sections: SectionRow[]) =>
  toRows(
    await apiJson<Response>("/admin/homepage", {
      method: "PUT",
      body: JSON.stringify({ sections }),
    }),
  );
