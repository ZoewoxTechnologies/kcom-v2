import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SortableTh, TableEmpty, TablePagination, pageItems } from "./DataTable";

describe("DataTable", () => {
  it("sets aria-sort on sortable headers", () => {
    const html = renderToStaticMarkup(
      <SortableTh direction="descending" onSort={() => {}}>
        Joined
      </SortableTh>,
    );
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('scope="col"');
  });

  it("windows page numbers for long lists", () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(1, 53)).toEqual([1, 2, "gap", 53]);
    expect(pageItems(27, 53)).toEqual([1, "gap", 26, 27, 28, "gap", 53]);
  });

  it("shows the range, current page and disabled edges", () => {
    const html = renderToStaticMarkup(
      <TablePagination page={1} pageSize={25} total={1312} onPageChange={() => {}} />,
    );
    expect(html).toContain("Showing 1–25 of 1,312");
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/aria-label="Previous page" disabled/);
  });

  it("renders an empty state spanning the columns", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <TableEmpty colSpan={4} title="No subscribers" />
        </tbody>
      </table>,
    );
    expect(html).toContain('colSpan="4"');
  });
});
