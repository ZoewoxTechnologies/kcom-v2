import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Banner,
  Button,
  Checkbox,
  IconButton,
  SelectField,
  TextField,
  TextareaField,
  useToast,
} from "@kcom/ui";
import { can } from "@kcom/permissions";
import { useAuth } from "../auth/AuthProvider";
import { EditorContainer, useDirtyState } from "../editor";
import {
  createPage,
  fetchSections,
  findPage,
  saveSections,
  updatePage,
  type PageRecord,
} from "./api";
import { BlockForm } from "./BlockForm";
import { blankProps, clean, validateBlock, withId, withoutId, type Block } from "./blocks";
import { BLOCK_LABELS, EDITABLE_PAGES, type EditablePage } from "./pages";

interface Form {
  title: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  blocks: Block[];
}

const icon = (d: string) => (
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
    <path d={d} />
  </svg>
);
const UP = icon("M6 15l6-6 6 6");
const DOWN = icon("M6 9l6 6 6-6");
const TRASH = icon("M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5");

/** Loads the page for /pages/:slug, which may not exist yet. */
export function SitePageEditor() {
  const { slug } = useParams();
  const config = EDITABLE_PAGES.find((p) => p.slug === slug);
  const [loaded, setLoaded] = useState<{ page: PageRecord | null; blocks: Block[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!config) return;
    let live = true;
    setLoaded(null);
    (async () => {
      const page = await findPage(config.slug);
      const sections = page ? await fetchSections(page.id) : [];
      return { page, blocks: sections.map(withId) };
    })().then(
      (r) => live && setLoaded(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [config]);

  if (!config)
    return (
      <section className="kc-site-page">
        <Banner variant="danger">That page can&rsquo;t be edited here.</Banner>
        <Link to="/pages">Back to pages</Link>
      </section>
    );
  if (failed)
    return (
      <section className="kc-site-page">
        <Banner variant="danger">Could not load this page.</Banner>
        <Link to="/pages">Back to pages</Link>
      </section>
    );
  if (!loaded) return <p className="kc-admin-loading">Loading page…</p>;
  return <Editor key={config.slug} config={config} initial={loaded.page} blocks={loaded.blocks} />;
}

function Editor({
  config,
  initial,
  blocks,
}: {
  config: EditablePage;
  initial: PageRecord | null;
  blocks: Block[];
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content:write");
  const canPublish = !!user && can(user.role, "content:publish");
  const [saved, setSaved] = useState(initial);
  const form = useDirtyState<Form>({
    title: initial?.title ?? config.title,
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? "",
    published: initial?.status === "published",
    blocks,
  });
  const v = form.value;
  const set = (patch: Partial<Form>) => form.setValue({ ...form.value, ...patch });
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [titleError, setTitleError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(config.allowed[0]!);
  const live = saved !== null && saved.status !== "draft";
  const locked = !canWrite || (live && !canPublish);

  const setBlock = (id: string, props: Record<string, unknown>) =>
    set({ blocks: v.blocks.map((b) => (b.id === id ? { ...b, props } : b)) });
  const moveBlock = (i: number, by: -1 | 1) => {
    const next = [...v.blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + by, 0, b!);
    set({ blocks: next });
  };

  const save = async () => {
    const found: typeof errors = {};
    for (const b of v.blocks) {
      const e = validateBlock(b);
      if (Object.keys(e).length) found[b.id] = e;
    }
    setErrors(found);
    setTitleError(v.title.trim() ? undefined : "Enter a title.");
    if (!v.title.trim() || Object.keys(found).length) return;
    const status = !v.published ? "draft" : saved?.status === "scheduled" ? "scheduled" : "published";
    const fields = {
      title: v.title.trim(),
      seoTitle: v.seoTitle.trim() || null,
      seoDescription: v.seoDescription.trim() || null,
      status: status as "draft" | "scheduled" | "published",
    };
    setSaving(true);
    try {
      const page = saved ? await updatePage(saved.id, fields) : await createPage(config.slug, fields);
      setSaved(page);
      const stored = await saveSections(
        page.id,
        v.blocks.map((b) => withoutId({ ...b, props: clean(b.props) as Record<string, unknown> })),
      );
      form.markSaved({ ...v, blocks: stored.map(withId) });
      toast({ variant: "success", title: "Page saved" });
    } catch {
      toast({ variant: "error", title: "Couldn’t save the page", description: "Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="kc-site-page">
      <EditorContainer
        variant="inline"
        title={config.title}
        subject={config.title}
        dirty={form.dirty}
        onClose={() => navigate("/pages")}
        actions={
          locked ? undefined : (
            <Button loading={saving} onClick={() => void save()}>
              Save
            </Button>
          )
        }
      >
        {locked && <Banner variant="info">Only admins can change a published page.</Banner>}
        {config.note && (
          <Banner variant="info">
            {config.note}{" "}
            {config.note.includes("Settings") && <Link to="/settings">Open Settings</Link>}
          </Banner>
        )}
        <div className="kc-site-page__grid">
          <div className="kc-site-page__main">
            {v.blocks.map((b, i) => (
              <div className="kc-site-page__block" key={b.id}>
                <div className="kc-site-page__blockhead">
                  <h2>{BLOCK_LABELS[b.type] ?? b.type}</h2>
                  <div className="kc-site-page__blocktools">
                    <IconButton
                      label={`Move ${BLOCK_LABELS[b.type] ?? b.type} ${i + 1} up`}
                      icon={UP}
                      disabled={locked || i === 0}
                      onClick={() => moveBlock(i, -1)}
                    />
                    <IconButton
                      label={`Move ${BLOCK_LABELS[b.type] ?? b.type} ${i + 1} down`}
                      icon={DOWN}
                      disabled={locked || i === v.blocks.length - 1}
                      onClick={() => moveBlock(i, 1)}
                    />
                    <IconButton
                      label={`Remove ${BLOCK_LABELS[b.type] ?? b.type} ${i + 1}`}
                      icon={TRASH}
                      disabled={locked}
                      onClick={() => set({ blocks: v.blocks.filter((x) => x.id !== b.id) })}
                    />
                  </div>
                </div>
                <BlockForm
                  type={b.type}
                  id={b.id}
                  props={b.props}
                  errors={errors[b.id] ?? {}}
                  disabled={locked}
                  onChange={(props) => setBlock(b.id, props)}
                />
              </div>
            ))}
            {!locked && (
              <div className="kc-site-page__add">
                <SelectField
                  label="Add a block"
                  value={adding}
                  onChange={(e) => setAdding(e.target.value)}
                >
                  {config.allowed.map((t) => (
                    <option key={t} value={t}>
                      {BLOCK_LABELS[t] ?? t}
                    </option>
                  ))}
                </SelectField>
                <Button
                  variant="secondary"
                  onClick={() =>
                    set({ blocks: [...v.blocks, withId({ type: adding, props: blankProps(adding) })] })
                  }
                >
                  Add block
                </Button>
              </div>
            )}
          </div>
          <aside className="kc-site-page__side">
            <div className="kc-site-page__card">
              <h2>Details</h2>
              <TextField
                label="Page title"
                required
                disabled={locked}
                error={titleError}
                value={v.title}
                onChange={(e) => set({ title: e.target.value })}
              />
              <TextField
                label="Search title"
                optional
                disabled={locked}
                value={v.seoTitle}
                onChange={(e) => set({ seoTitle: e.target.value })}
              />
              <TextareaField
                label="Search description"
                optional
                rows={3}
                disabled={locked}
                value={v.seoDescription}
                onChange={(e) => set({ seoDescription: e.target.value })}
              />
              {canPublish && (
                <Checkbox
                  label="Published"
                  checked={v.published}
                  disabled={locked}
                  onChange={(e) => set({ published: e.target.checked })}
                />
              )}
            </div>
          </aside>
        </div>
      </EditorContainer>
    </section>
  );
}
