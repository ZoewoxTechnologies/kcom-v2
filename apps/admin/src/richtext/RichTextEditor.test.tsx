import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RICH_TEXT_MARKS, RICH_TEXT_NODES, isSafeHref } from "@kcom/content";
import { isCloudinaryImageUrl } from "@kcom/media";
import { useDirtyState } from "../editor";
import { RichTextEditor, emptyRichText } from "./RichTextEditor";
import type { RichTextDoc } from "./RichTextEditor";

/** True when every node, mark and attribute is one the stored format allows. */
function conforms(n: unknown): boolean {
  const node = n as {
    type: string;
    attrs?: Record<string, unknown>;
    marks?: { type: string; attrs?: { href?: string } }[];
    content?: unknown[];
  };
  if (!RICH_TEXT_NODES.has(node.type)) return false;
  const keys = Object.keys(node.attrs ?? {});
  const allowed: Record<string, string[]> = {
    heading: ["level"],
    image: ["src", "alt", "width", "height"],
  };
  if (keys.some((k) => !(allowed[node.type] ?? []).includes(k))) return false;
  if (node.type === "image" && !isCloudinaryImageUrl(String(node.attrs?.src))) return false;
  const marksOk = (node.marks ?? []).every(
    (m) =>
      RICH_TEXT_MARKS.has(m.type) &&
      (m.type !== "link" ||
        (Object.keys(m.attrs ?? {}).join() === "href" && isSafeHref(m.attrs?.href))),
  );
  return marksOk && (node.content ?? []).every(conforms);
}

const IMG = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";

const full: RichTextDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Peace" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Fear ", marks: [{ type: "bold" }] },
        { type: "text", text: "not", marks: [{ type: "italic" }, { type: "underline" }] },
        { type: "hardBreak" },
        {
          type: "text",
          text: "site",
          marks: [{ type: "link", attrs: { href: "https://a.test" } }],
        },
      ],
    },
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Isaiah 26:3" }] }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }],
        },
      ],
    },
    { type: "image", attrs: { src: IMG, alt: "a", width: 800, height: 600 } },
  ],
};

function Harness({
  initial,
  upload,
}: {
  initial: RichTextDoc;
  upload?: () => Promise<{ src: string; width?: number; height?: number }>;
}) {
  const form = useDirtyState(initial);
  const [last, setLast] = useState<RichTextDoc | null>(null);
  return (
    <>
      <RichTextEditor
        aria-label="Body"
        value={form.value}
        onChange={(d) => {
          setLast(d);
          form.setValue(d);
        }}
        upload={upload}
      />
      <output data-testid="dirty">{String(form.dirty)}</output>
      <output data-testid="json">{JSON.stringify(last)}</output>
    </>
  );
}

describe("RichTextEditor", () => {
  it("renders every stored node and emits only what the stored format allows", async () => {
    let doc: RichTextDoc | null = null;
    render(<RichTextEditor aria-label="Body" value={full} onChange={(d) => (doc = d)} />);
    await screen.findByRole("textbox");
    expect(screen.getByRole("heading", { level: 2, name: "Peace" })).toBeInTheDocument();
    expect(screen.getByRole("textbox").querySelector("blockquote")).toBeTruthy();
    expect(screen.getByRole("textbox").querySelector("img")).toHaveAttribute("src", IMG);
    // Edit to force an emit, then check the emitted doc is exactly what the API keeps.
    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("x");
    await waitFor(() => expect(doc).not.toBeNull());
    expect(conforms(doc)).toBe(true);
  });

  it("is clean until edited, then dirty", async () => {
    render(<Harness initial={emptyRichText} />);
    await screen.findByRole("textbox");
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");
    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("Hello");
    await waitFor(() => expect(screen.getByTestId("dirty")).toHaveTextContent("true"));
  });

  it("inserts an uploaded image", async () => {
    render(
      <Harness
        initial={emptyRichText}
        upload={() => Promise.resolve({ src: IMG, width: 800, height: 600 })}
      />,
    );
    await screen.findByRole("textbox");
    await userEvent.upload(
      screen.getByTestId("rte-file"),
      new File(["x"], "pic.png", { type: "image/png" }),
    );
    const alt = await screen.findByLabelText(/Describe pic.png/);
    await userEvent.click(screen.getByRole("button", { name: "Add image" }));
    expect(screen.getByTestId("json").textContent).not.toContain(IMG); // alt text is required first
    await userEvent.type(alt, "A pic");
    await userEvent.click(screen.getByRole("button", { name: "Add image" }));
    await waitFor(() => expect(screen.getByTestId("json").textContent).toContain(IMG));
    expect(JSON.parse(screen.getByTestId("json").textContent!).content[0].attrs).toEqual({
      src: IMG,
      alt: "A pic",
      width: 800,
      height: 600,
    });
  });

  it("shows an error for a failed upload and for a wrong file type", async () => {
    render(<Harness initial={emptyRichText} upload={() => Promise.reject(new Error("Nope"))} />);
    await screen.findByRole("textbox");
    const input = screen.getByTestId("rte-file");
    await act(async () => {
      await userEvent.upload(input, new File(["x"], "a.png", { type: "image/png" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("a.png: Nope");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
    const bad = new File(["x"], "a.gif", { type: "image/gif" });
    // The input's accept filter would block this in a browser; drop bypasses it.
    vi.spyOn(input as HTMLInputElement, "files", "get").mockReturnValue([
      bad,
    ] as unknown as FileList);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PNG, JPEG or WebP");
  });

  it("will not insert an image with blank alt text", async () => {
    render(<Harness initial={emptyRichText} upload={() => Promise.resolve({ src: IMG })} />);
    await screen.findByRole("textbox");
    await userEvent.upload(
      screen.getByTestId("rte-file"),
      new File(["x"], "pic.png", { type: "image/png" }),
    );
    const alt = await screen.findByLabelText(/Describe pic.png/);
    await userEvent.type(alt, "   ");
    expect(screen.getByRole("button", { name: "Add image" })).toBeDisabled();
  });

  it("has one toolbar tab stop that moves with the arrow keys", async () => {
    render(<Harness initial={emptyRichText} />);
    await screen.findByRole("textbox");
    const bar = screen.getByRole("toolbar");
    const buttons = within(bar).getAllByRole("button");
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    buttons[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(buttons[1]).toHaveFocus();
    expect(buttons[1]!.tabIndex).toBe(0);
    expect(buttons[0]!.tabIndex).toBe(-1);
    await userEvent.keyboard("{End}");
    expect(buttons.at(-1)).toHaveFocus();
  });

  it("rejects unsafe link addresses", async () => {
    render(<Harness initial={emptyRichText} />);
    await screen.findByRole("textbox");
    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    await userEvent.type(screen.getByLabelText("Link address"), "javascript:alert(1){Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("http(s)");
  });
});
