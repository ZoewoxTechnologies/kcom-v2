import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DataTable,
  SortableTh,
  TableEmpty,
  TablePagination,
  type DataTableColumn,
} from "./DataTable";

type Row = { id: number; name: string; age: number };
const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "age", header: "Age", align: "end", accessor: (r) => `${r.age} yrs` },
  { key: "x", header: "Custom", render: (r) => <em>{r.name.toUpperCase()}</em> },
];
const rows: Row[] = [
  { id: 1, name: "Ada", age: 36 },
  { id: 2, name: "Bo", age: 41 },
];
const noop = () => {};

describe("DataTable", () => {
  it("renders cells via key, accessor and render", () => {
    const html = renderToStaticMarkup(
      <DataTable caption="People" columns={columns} rows={rows} getRowId={(r) => r.id} />,
    );
    expect(html).toContain("<caption");
    expect(html).toContain(">Ada<");
    expect(html).toContain("36 yrs");
    expect(html).toContain("<em>BO</em>");
    expect(html).toContain("kc-table__num");
  });

  it("sets aria-sort only on sortable headers, from controlled state", () => {
    const html = renderToStaticMarkup(
      <DataTable
        caption="People"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={{ key: "name", direction: "descending" }}
        onSortChange={noop}
      />,
    );
    expect(html).toContain('aria-sort="descending"');
    expect(html.match(/aria-sort/g)).toHaveLength(1);
  });

  it("shows the empty state across all columns including the action column", () => {
    const html = renderToStaticMarkup(
      <DataTable
        caption="People"
        columns={columns}
        rows={[]}
        getRowId={(r: Row) => r.id}
        emptyTitle="No people"
        rowAction={() => null}
      />,
    );
    expect(html).toContain("No people");
    expect(html).toContain('colSpan="4"');
  });

  it("marks the selected row, makes rows focusable and renders row actions", () => {
    const html = renderToStaticMarkup(
      <DataTable
        caption="People"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        selectedRowId={2}
        onRowClick={noop}
        rowAction={(r) => <button>Edit {r.name}</button>}
      />,
    );
    expect(html.match(/data-selected="true"/g)).toHaveLength(1);
    expect(html).toContain("Selected: ");
    expect(html).not.toContain("aria-selected");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Edit Ada");
  });

  it("renders pagination when given", () => {
    const html = renderToStaticMarkup(
      <DataTable
        caption="People"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        pagination={{ page: 2, pageSize: 2, total: 5, onPageChange: noop }}
      />,
    );
    expect(html).toContain("Showing 3–4 of 5");
  });
});

describe("building blocks", () => {
  it("sortable header sets aria-sort and scope", () => {
    const html = renderToStaticMarkup(
      <SortableTh direction="descending" onSort={noop}>
        Joined
      </SortableTh>,
    );
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('scope="col"');
  });

  it("pagination shows range, current page and disabled edges", () => {
    const html = renderToStaticMarkup(
      <TablePagination page={1} pageSize={25} total={1312} onPageChange={noop} />,
    );
    expect(html).toContain("Showing 1–25 of 1,312");
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/aria-label="Previous page" disabled/);
  });

  it("empty row spans columns", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <TableEmpty colSpan={4} title="None" />
        </tbody>
      </table>,
    );
    expect(html).toContain('colSpan="4"');
  });
});
