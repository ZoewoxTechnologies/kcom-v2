import { Field } from "@kcom/ui";
import { useDirtyState } from "../editor";
import { RichTextEditor } from "../richtext/RichTextEditor";
import type { RichTextDoc } from "../richtext/RichTextEditor";

const sample: RichTextDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A sound mind" }] },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Fear is not from God. When the enemy whispers worry, the believer answers with ",
        },
        { type: "text", text: "the Word", marks: [{ type: "bold" }] },
        { type: "text", text: "." },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "“Thou wilt keep him in perfect peace, whose mind is stayed on thee.” Isaiah 26:3",
            },
          ],
        },
      ],
    },
    {
      type: "bulletList",
      content: ["Read it aloud", "Write it down"].map((t) => ({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
      })),
    },
  ],
};

/** Rich text field: edit to see it go dirty; paste from Word or Google Docs; add an image. */
export function RichTextDemo() {
  const form = useDirtyState(sample);
  return (
    <section aria-label="Rich text demo" style={{ marginTop: "2rem", maxWidth: "52rem" }}>
      <h2>Rich text</h2>
      <Field label="Body" help={form.dirty ? "Unsaved changes" : "No changes"}>
        {(c) => (
          <RichTextEditor
            value={form.value}
            onChange={form.setValue}
            aria-describedby={c["aria-describedby"]}
            aria-label="Body"
          />
        )}
      </Field>
    </section>
  );
}
