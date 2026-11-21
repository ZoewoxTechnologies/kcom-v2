import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Banner, Button, Tooltip } from "@kcom/ui";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { isSafeHref } from "@kcom/content";
import { richTextExtensions, toStoredDoc } from "./extensions";
import { cleanPastedHtml } from "./cleanPaste";
import { uploadImage as defaultUpload, validateImageFile } from "./uploadImage";
import type { UploadedImage } from "./uploadImage";
import "./rich-text-editor.css";

/** The stored rich-text document (see `@kcom/content`). */
export type RichTextDoc = Record<string, unknown>;

export const emptyRichText: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };

export interface RichTextEditorProps {
  value: RichTextDoc;
  /** Called with the stored document on every user edit. Use with `useDirtyState`. */
  onChange: (doc: RichTextDoc) => void;
  /** Accessible name when no visible label is tied to the editor. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  placeholder?: string;
  /** Uploads an image and resolves to its URL and size. Defaults to Cloudinary via the admin API. */
  upload?: (file: File, onProgress: (fraction: number) => void) => Promise<UploadedImage>;
  disabled?: boolean;
}

type Upload = { name: string; progress: number; error?: string };

/** JSON with sorted keys, so documents compare equal whatever their key order. */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

function withUpload(all: Record<number, Upload>, id: number, u: Upload | null) {
  const next = { ...all };
  if (u) next[id] = u;
  else delete next[id];
  return next;
}

interface Command {
  label: string;
  /** What the button shows; icon-only ones get a tooltip with the label. */
  glyph: ReactNode;
  iconOnly?: boolean;
  active: boolean;
  run: () => void;
}

function Toolbar({
  editor,
  onPickImage,
  disabled,
}: {
  editor: Editor;
  onPickImage: () => void;
  disabled?: boolean;
}) {
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState("");
  const [bad, setBad] = useState(false);
  const [stop, setStop] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const is = (n: string, a?: object) => editor.isActive(n, a);
  const chain = () => editor.chain().focus();

  const applyLink = () => {
    const value = href.trim();
    if (!value) chain().extendMarkRange("link").unsetLink().run();
    else if (isSafeHref(value)) chain().extendMarkRange("link").setLink({ href: value }).run();
    else return setBad(true);
    setLinking(false);
    setBad(false);
  };

  const commands: Command[] = [
    {
      label: "Bold",
      glyph: <b>B</b>,
      iconOnly: true,
      active: is("bold"),
      run: () => chain().toggleBold().run(),
    },
    {
      label: "Italic",
      glyph: <i>I</i>,
      iconOnly: true,
      active: is("italic"),
      run: () => chain().toggleItalic().run(),
    },
    {
      label: "Underline",
      glyph: <u>U</u>,
      iconOnly: true,
      active: is("underline"),
      run: () => chain().toggleUnderline().run(),
    },
    {
      label: "Heading 2",
      glyph: "H2",
      iconOnly: true,
      active: is("heading", { level: 2 }),
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      glyph: "H3",
      iconOnly: true,
      active: is("heading", { level: 3 }),
      run: () => chain().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Scripture quote",
      glyph: "\u201C Quote",
      active: is("blockquote"),
      run: () => chain().toggleBlockquote().run(),
    },
    {
      label: "Bulleted list",
      glyph: "\u2022 List",
      active: is("bulletList"),
      run: () => chain().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      glyph: "1.",
      iconOnly: true,
      active: is("orderedList"),
      run: () => chain().toggleOrderedList().run(),
    },
    {
      label: "Link",
      glyph: "Link",
      active: is("link"),
      run: () => {
        setHref((editor.getAttributes("link").href as string | undefined) ?? "");
        setLinking((v) => !v);
        setBad(false);
      },
    },
    { label: "Insert image", glyph: "Image", active: false, run: onPickImage },
  ];

  const buttons = () =>
    [...(bar.current?.querySelectorAll<HTMLButtonElement>("button[data-tb]") ?? [])].filter(
      (b) => !b.disabled,
    );
  // Roving tabindex: one tab stop for the toolbar, arrows move within it.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = buttons();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next = {
      ArrowRight: (at + 1) % all.length,
      ArrowLeft: (at - 1 + all.length) % all.length,
      Home: 0,
      End: all.length - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setStop(next);
    all[next]?.focus();
  };

  return (
    <div
      ref={bar}
      className="kc-rte__toolbar"
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={onKeyDown}
    >
      {commands.map((c, i) => {
        const button = (
          <button
            type="button"
            data-tb
            className="kc-rte__btn"
            aria-label={c.label}
            aria-pressed={c.label === "Insert image" ? undefined : c.active}
            disabled={disabled}
            tabIndex={i === stop ? 0 : -1}
            onFocus={() => setStop(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={c.run}
          >
            {c.glyph}
          </button>
        );
        return c.iconOnly ? (
          <Tooltip key={c.label} label={c.label}>
            {button}
          </Tooltip>
        ) : (
          <span key={c.label} className="kc-rte__item">
            {button}
          </span>
        );
      })}
      {linking && (
        <form
          className="kc-rte__link"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            type="text"
            aria-label="Link address"
            aria-invalid={bad || undefined}
            placeholder="https://\u2026"
            value={href}
            onChange={(e) => setHref(e.target.value)}
          />
          <button type="submit" className="kc-btn kc-btn--secondary">
            Apply
          </button>
          {bad && (
            <span role="alert" className="kc-rte__error">
              Use an http(s) or mailto address.
            </span>
          )}
        </form>
      )}
    </div>
  );
}

/** Rich text field. Emits and accepts exactly the document the API stores. */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Continue writing…",
  upload = defaultUpload,
  disabled,
  ...aria
}: RichTextEditorProps) {
  const [uploads, setUploads] = useState<Record<number, Upload>>({});
  const [pending, setPending] = useState<
    { key: number; image: UploadedImage; alt: string; name: string }[]
  >([]);
  const nextId = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emitted = useRef<string>(JSON.stringify(value));
  const valueRef = useRef(value);
  valueRef.current = value;

  const editor = useEditor({
    extensions: richTextExtensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      const doc = toStoredDoc(ed.getJSON()) as RichTextDoc;
      // The editor re-emits the document on mount (key order, normalisation); that is not an edit.
      if (canon(doc) === canon(valueRef.current)) return;
      emitted.current = JSON.stringify(doc);
      onChangeRef.current(doc);
    },
    editorProps: {
      transformPastedHTML: cleanPastedHtml,
      attributes: {
        class: "kc-rte__content",
        role: "textbox",
        "aria-multiline": "true",
        ...(Object.fromEntries(Object.entries(aria).filter(([, v]) => v !== undefined)) as Record<
          string,
          string
        >),
      },
      handleDrop: (_v, e) => takeFiles((e as DragEvent).dataTransfer?.files),
      handlePaste: (_v, e) => takeFiles(e.clipboardData?.files),
    },
  });

  // Follow external value changes (reset, save baseline) without echoing our own edits.
  useEffect(() => {
    if (editor && JSON.stringify(value) !== emitted.current) {
      emitted.current = JSON.stringify(value);
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);
  useEffect(() => editor?.setEditable(!disabled), [editor, disabled]);

  function takeFiles(files: FileList | null | undefined): boolean {
    const images = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    images.forEach(startUpload);
    return images.length > 0;
  }

  function startUpload(file: File) {
    const id = nextId.current++;
    const set = (u: Upload | null) => setUploads((all) => withUpload(all, id, u));
    const invalid = validateImageFile(file);
    if (invalid) return set({ name: file.name, progress: 0, error: invalid });
    set({ name: file.name, progress: 0 });
    upload(file, (progress) => set({ name: file.name, progress }))
      .then((image) => {
        // Alt text is required: hold the image until the author describes it.
        setPending((all) => [...all, { key: id, image, alt: "", name: file.name }]);
        set(null);
      })
      .catch((err: unknown) =>
        set({
          name: file.name,
          progress: 0,
          error: err instanceof Error ? err.message : "Upload failed.",
        }),
      );
  }

  if (!editor) return null;
  return (
    <div className="kc-rte" data-disabled={disabled || undefined}>
      <Toolbar editor={editor} disabled={disabled} onPickImage={() => fileInput.current?.click()} />
      <input
        ref={fileInput}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        data-testid="rte-file"
        onChange={(e) => {
          [...(e.target.files ?? [])].forEach(startUpload);
          e.target.value = "";
        }}
      />
      <div
        className="kc-rte__body"
        data-placeholder={placeholder}
        data-empty={editor.isEmpty || undefined}
      >
        <EditorContent editor={editor} />
      </div>
      {pending.map((p, i) => (
        <form
          key={p.key}
          className="kc-rte__upload"
          onSubmit={(e) => {
            e.preventDefault();
            editor
              .chain()
              .focus()
              .setImage({ ...p.image, alt: p.alt.trim() })
              .run();
            setPending((all) => all.filter((_, j) => j !== i));
          }}
        >
          <img src={p.image.src} alt="" className="kc-rte__thumb" />
          <input
            autoFocus
            aria-label={`Describe ${p.name} for people who cannot see it`}
            placeholder="Describe this image (alt text)"
            value={p.alt}
            onChange={(e) =>
              setPending((all) => all.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))
            }
          />
          <button type="submit" className="kc-btn kc-btn--secondary" disabled={!p.alt.trim()}>
            Add image
          </button>
          <button
            type="button"
            className="kc-btn kc-btn--secondary"
            onClick={() => setPending((all) => all.filter((_, j) => j !== i))}
          >
            Discard
          </button>
        </form>
      ))}
      {Object.entries(uploads).map(([id, u]) =>
        u.error ? (
          <Banner
            key={id}
            variant="danger"
            action={
              <Button
                variant="tertiary"
                onClick={() => setUploads((all) => withUpload(all, Number(id), null))}
              >
                Dismiss
              </Button>
            }
          >
            {u.name}: {u.error}
          </Banner>
        ) : (
          <div key={id} className="kc-rte__upload" role="status">
            <span>Uploading {u.name}…</span>
            <progress value={u.progress} max={1} aria-label={`Uploading ${u.name}`} />
          </div>
        ),
      )}
    </div>
  );
}
