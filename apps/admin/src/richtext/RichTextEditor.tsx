import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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

function Btn(props: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="kc-rte__btn"
      aria-label={props.label}
      aria-pressed={props.active ?? false}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
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
  const is = (n: string, a?: object) => editor.isActive(n, a);

  const applyLink = () => {
    if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else if (isSafeHref(href.trim()))
      editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
    else return setBad(true);
    setLinking(false);
    setBad(false);
  };

  return (
    <div className="kc-rte__toolbar" role="toolbar" aria-label="Formatting">
      <Btn
        label="Bold"
        active={is("bold")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </Btn>
      <Btn
        label="Italic"
        active={is("italic")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </Btn>
      <Btn
        label="Underline"
        active={is("underline")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <u>U</u>
      </Btn>
      <Btn
        label="Heading 2"
        active={is("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </Btn>
      <Btn
        label="Heading 3"
        active={is("heading", { level: 3 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </Btn>
      <Btn
        label="Scripture quote"
        active={is("blockquote")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        “ Quote
      </Btn>
      <Btn
        label="Bulleted list"
        active={is("bulletList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </Btn>
      <Btn
        label="Numbered list"
        active={is("orderedList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </Btn>
      <Btn
        label="Link"
        active={is("link")}
        disabled={disabled}
        onClick={() => {
          setHref((editor.getAttributes("link").href as string | undefined) ?? "");
          setLinking((v) => !v);
          setBad(false);
        }}
      >
        Link
      </Btn>
      <Btn label="Insert image" disabled={disabled} onClick={onPickImage}>
        Image
      </Btn>
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
            placeholder="https://…"
            value={href}
            onChange={(e) => setHref(e.target.value)}
          />
          <button type="submit" className="kc-rte__btn">
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
  const [pending, setPending] = useState<{ image: UploadedImage; alt: string; name: string }[]>([]);
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
        setPending((all) => [...all, { image, alt: "", name: file.name }]);
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
          key={p.image.src}
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
            required
            aria-label={`Describe ${p.name} for people who cannot see it`}
            placeholder="Describe this image (alt text)"
            value={p.alt}
            onChange={(e) =>
              setPending((all) => all.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))
            }
          />
          <button type="submit" className="kc-rte__btn">
            Add image
          </button>
          <button
            type="button"
            className="kc-rte__btn"
            onClick={() => setPending((all) => all.filter((_, j) => j !== i))}
          >
            Discard
          </button>
        </form>
      ))}
      {Object.entries(uploads).map(([id, u]) => (
        <div key={id} className="kc-rte__upload" role={u.error ? "alert" : "status"}>
          {u.error ? (
            <>
              <span className="kc-rte__error">
                {u.name}: {u.error}
              </span>
              <button
                type="button"
                className="kc-rte__btn"
                onClick={() => setUploads((all) => withUpload(all, Number(id), null))}
              >
                Dismiss
              </button>
            </>
          ) : (
            <>
              <span>Uploading {u.name}…</span>
              <progress value={u.progress} max={1} aria-label={`Uploading ${u.name}`} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
