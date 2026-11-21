import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  TextField,
  Tooltip,
  UnsavedChangesPrompt,
  useToast,
} from "@kcom/ui";
import type { DataTableColumn } from "@kcom/ui";
import { can } from "@kcom/permissions";
import { slugify } from "@kcom/content";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { EditorContainer, useDirtyState } from "../editor";
import { ImageUploadField } from "../media/ImageUploadField";
import { emptyRichText, RichTextEditor } from "../richtext/RichTextEditor";
import type { RichTextDoc } from "../richtext/RichTextEditor";
import {
  createBook,
  deleteBook,
  listBooks,
  saveBookOrder,
  updateBook,
  type BookRecord,
  type BookStatus,
} from "./api";

interface Form {
  title: string;
  coverUrl: string | null;
  description: RichTextDoc;
  purchaseUrl: string;
}

const blank: Form = { title: "", coverUrl: null, description: emptyRichText, purchaseUrl: "" };

const toForm = (b: BookRecord): Form => ({
  title: b.title,
  coverUrl: b.coverUrl,
  description: b.description ?? emptyRichText,
  purchaseUrl: b.purchaseUrl ?? "",
});

/** A description with no text at all is stored as null. */
const isEmptyDoc = (doc: RichTextDoc): boolean => {
  const blocks = (doc.content ?? []) as { type?: string; content?: unknown[] }[];
  return blocks.every((n) => n.type === "paragraph" && !n.content?.length);
};

const statusLabel: Record<BookStatus, string> = { draft: "Draft", published: "Published" };

const Arrow = ({ up }: { up: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

/** What the page needs from the open editor to guard switching books. */
interface EditorGuard {
  dirty: boolean;
  title: string;
}

/** Admin Books: the list in display order beside a side-panel editor. */
export function BooksPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content:write");
  const [books, setBooks] = useState<BookRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  /** "new", a book id, or null when nothing is selected. */
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const guard = useRef<EditorGuard | null>(null);
  const [switchTo, setSwitchTo] = useState<{ target: string | "new" } | null>(null);
  const [deleting, setDeleting] = useState<BookRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);

  const select = (target: string | "new") => {
    if (target === selected) return;
    if (guard.current?.dirty) setSwitchTo({ target });
    else setSelected(target);
  };

  const load = useCallback(async () => {
    try {
      setBooks(await listBooks());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const editing = selected && selected !== "new" ? books?.find((b) => b.id === selected) : null;

  const move = async (book: BookRecord, by: -1 | 1) => {
    if (!books || moving) return;
    const from = books.findIndex((b) => b.id === book.id);
    const to = from + by;
    if (to < 0 || to >= books.length) return;
    const next = [...books];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setBooks(next);
    setMoving(true);
    try {
      await saveBookOrder(next.map((b) => b.id));
    } catch {
      toast({ variant: "error", title: "Couldn’t save the order", description: "Try again." });
      await load();
    } finally {
      setMoving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteBook(deleting.id);
      if (selected === deleting.id) setSelected(null);
      setDeleting(null);
      toast({ variant: "success", title: "Book deleted" });
      await load();
    } catch {
      toast({ variant: "error", title: "Couldn’t delete the book", description: "Try again." });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<BookRecord>[] = [
    {
      key: "cover",
      header: <span className="kc-visually-hidden">Cover</span>,
      width: "3rem",
      render: (b) =>
        b.coverUrl ? <img className="kc-books__cover" src={b.coverUrl} alt="" /> : null,
    },
    { key: "title", header: "Book", accessor: (b) => b.title },
    {
      key: "status",
      header: "Status",
      width: "7rem",
      render: (b) => <Badge variant={b.status}>{statusLabel[b.status]}</Badge>,
    },
    ...(canWrite
      ? [
          {
            key: "order",
            header: <span className="kc-visually-hidden">Order</span>,
            width: "6.5rem",
            align: "end" as const,
            render: (b: BookRecord) => {
              const i = books?.findIndex((x) => x.id === b.id) ?? 0;
              return (
                <span className="kc-books__move" onClick={(e) => e.stopPropagation()}>
                  <Tooltip label="Move up">
                    <Button
                      variant="tertiary"
                      className="kc-books__icon"
                      aria-label={`Move ${b.title} up`}
                      disabled={moving || i === 0}
                      onClick={() => void move(b, -1)}
                    >
                      <Arrow up />
                    </Button>
                  </Tooltip>
                  <Tooltip label="Move down">
                    <Button
                      variant="tertiary"
                      className="kc-books__icon"
                      aria-label={`Move ${b.title} down`}
                      disabled={moving || i === (books?.length ?? 1) - 1}
                      onClick={() => void move(b, 1)}
                    >
                      <Arrow up={false} />
                    </Button>
                  </Tooltip>
                </span>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <section className="kc-books">
      <header className="kc-books__head">
        <h1>Books</h1>
        {canWrite && <Button onClick={() => select("new")}>New book</Button>}
      </header>
      <div className="kc-books__body">
        <div className="kc-books__list">
          {loadFailed ? (
            <Banner
              variant="danger"
              action={
                <Button variant="tertiary" onClick={() => void load()}>
                  Retry
                </Button>
              }
            >
              Couldn&rsquo;t load books
            </Banner>
          ) : books === null ? (
            <p className="kc-books__loading">Loading books…</p>
          ) : (
            <DataTable
              caption="Books"
              columns={columns}
              rows={books}
              getRowId={(b) => b.id}
              selectedRowId={editing?.id ?? null}
              onRowClick={(b) => select(b.id)}
              emptyTitle="No books yet"
              emptyMessage="Create a book to see it here."
            />
          )}
        </div>
        <div className="kc-books__side">
          {selected && (selected === "new" || editing) ? (
            <BookEditor
              key={selected}
              book={editing ?? null}
              nextPosition={books?.length ?? 0}
              guard={guard}
              onClose={() => setSelected(null)}
              onSaved={load}
              onDelete={editing ? () => setDeleting(editing) : undefined}
            />
          ) : (
            <aside className="kc-books__empty">
              <h2>No book selected</h2>
              <p>Pick a book on the left to edit it{canWrite ? ", or click New book" : ""}.</p>
            </aside>
          )}
        </div>
      </div>
      <UnsavedChangesPrompt
        open={switchTo !== null}
        onOpenChange={(open) => !open && setSwitchTo(null)}
        subject={guard.current?.title}
        onKeepEditing={() => setSwitchTo(null)}
        onDiscard={() => {
          if (switchTo) setSelected(switchTo.target);
          setSwitchTo(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        variant="danger"
        busy={busy}
        title="Delete this book?"
        message={
          <>&ldquo;{deleting?.title}&rdquo; will be deleted for good. This can&rsquo;t be undone.</>
        }
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </section>
  );
}

interface EditorProps {
  guard: { current: EditorGuard | null };
  book: BookRecord | null;
  /** Position given to a new book, so it joins the end of the list. */
  nextPosition: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDelete?: () => void;
}

function BookEditor({ book, nextPosition, guard, onClose, onSaved, onDelete }: EditorProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content:write");
  const canPublish = !!user && can(user.role, "content:publish");
  const form = useDirtyState<Form>(book ? toForm(book) : blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(book);
  const v = form.value;
  const set = (patch: Partial<Form>) => form.setValue({ ...form.value, ...patch });

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!v.title.trim()) next.title = "Enter a title.";
    else if (!slugify(v.title)) next.title = "Use at least one letter or number in the title.";
    if (v.purchaseUrl.trim() && !/^https?:\/\/\S+$/i.test(v.purchaseUrl.trim()))
      next.purchaseUrl = "Enter a link starting with https://";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Throws on failure so the unsaved-changes prompt keeps the editor open. */
  const save = async (status: BookStatus) => {
    if (!validate()) throw new Error("invalid");
    const body = {
      title: v.title.trim(),
      coverUrl: v.coverUrl,
      purchaseUrl: v.purchaseUrl.trim() || null,
      description: isEmptyDoc(v.description) ? null : v.description,
      status,
    };
    setSaving(true);
    try {
      const result = saved
        ? await updateBook(saved.id, body)
        : await createBook({ ...body, slug: slugify(v.title), position: nextPosition });
      setSaved(result);
      form.markSaved();
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setErrors({ title: "Another book already uses this title. Make it different." });
      else if (!(err instanceof Error && err.message === "invalid"))
        toast({ variant: "error", title: "Couldn’t save the book", description: "Try again." });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const saveAndClose = (status: BookStatus, message: string) => async () => {
    try {
      await save(status);
    } catch {
      return;
    }
    toast({ variant: "success", title: message });
    onClose();
  };

  const published = saved?.status === "published";
  useEffect(() => {
    guard.current = { dirty: form.dirty, title: v.title };
  });
  useEffect(() => () => void (guard.current = null), [guard]);
  const canDelete = canWrite && (!published || canPublish);
  return (
    <EditorContainer
      variant="inline"
      title={saved ? "Editing" : "New book"}
      subject={v.title || undefined}
      dirty={form.dirty}
      onClose={onClose}
      headerActions={
        onDelete && canDelete ? (
          <Tooltip label="Delete book">
            <Button
              variant="tertiary"
              className="kc-books__delete"
              aria-label="Delete book"
              disabled={saving}
              onClick={onDelete}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
              </svg>
            </Button>
          </Tooltip>
        ) : undefined
      }
      actions={
        <>
          {published && canPublish && (
            <>
              <Button disabled={saving} onClick={saveAndClose("published", "Book saved")}>
                Save changes
              </Button>
              <Button
                variant="tertiary"
                disabled={saving}
                onClick={saveAndClose("draft", "Book unpublished")}
              >
                Unpublish
              </Button>
            </>
          )}
          {!published && (
            <>
              {canPublish && (
                <Button disabled={saving} onClick={saveAndClose("published", "Book published")}>
                  Publish
                </Button>
              )}
              {canWrite && (
                <Button
                  variant={canPublish ? "tertiary" : "primary"}
                  disabled={saving}
                  onClick={saveAndClose("draft", "Draft saved")}
                >
                  Save draft
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      <div className="kc-books__form">
        <TextField
          label="Title"
          required
          value={v.title}
          error={errors.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <ImageUploadField
          label="Cover"
          optional
          help="PNG, JPEG or WebP."
          value={v.coverUrl}
          onChange={(coverUrl) => set({ coverUrl })}
        />
        <Field label="Description" optional>
          {(c) => (
            <RichTextEditor
              value={v.description}
              onChange={(description) => set({ description })}
              aria-label="Description"
              aria-describedby={c["aria-describedby"]}
            />
          )}
        </Field>
        <TextField
          label="How to get a copy (link)"
          optional
          type="url"
          inputMode="url"
          help="The “How to get a copy” button on the book page goes here."
          error={errors.purchaseUrl}
          value={v.purchaseUrl}
          onChange={(e) => set({ purchaseUrl: e.target.value })}
        />
      </div>
    </EditorContainer>
  );
}
