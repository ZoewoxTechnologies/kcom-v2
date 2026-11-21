import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  IconButton,
  TextareaField,
  TextField,
  DEFAULT_TIME_ZONE,
  useToast,
} from "@kcom/ui";
import { can } from "@kcom/permissions";
import { slugify } from "@kcom/content";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { EditorContainer, ImageUploadField, useDirtyState } from "../editor";
import { RichTextEditor, emptyRichText, type RichTextDoc } from "../richtext/RichTextEditor";
import {
  createPost,
  deletePost,
  getPost,
  postEditPath,
  updatePost,
  type PostRecord,
  type PostStatus,
} from "./api";

interface Form {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  tags: string;
  heroImageUrl: string | null;
  body: RichTextDoc;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const today = () => new Date().toISOString().slice(0, 10);

const blank = (): Form => ({
  title: "",
  slug: "",
  date: today(),
  excerpt: "",
  tags: "",
  heroImageUrl: null,
  body: emptyRichText,
});

const toForm = (p: PostRecord): Form => ({
  title: p.title,
  slug: p.slug,
  date: p.date,
  excerpt: p.excerpt ?? "",
  tags: p.tags.join(", "),
  heroImageUrl: p.heroImageUrl,
  body: p.body,
});

const parseTags = (s: string) => [
  ...new Set(
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  ),
];

/** Loads the post for /blog/:id, or opens a blank editor for /blog/new. */
export function BlogEditorPage({ isNew = false }: { isNew?: boolean }) {
  const { id } = useParams();
  const [post, setPost] = useState<PostRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(isNew ? "ready" : "loading");
  useEffect(() => {
    if (isNew || !id) return;
    let live = true;
    getPost(id).then(
      (p) => live && (setPost(p), setState("ready")),
      () => live && setState("error"),
    );
    return () => {
      live = false;
    };
  }, [id, isNew]);

  if (state === "loading") return <p className="kc-admin-loading">Loading post…</p>;
  if (state === "error")
    return (
      <section className="kc-blog">
        <Banner variant="danger">Could not load this post.</Banner>
        <Link to="/blog">Back to blog</Link>
      </section>
    );
  return <PostEditor key={id ?? "new"} initial={post} />;
}

function PostEditor({ initial }: { initial: PostRecord | null }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content:write");
  const canPublish = !!user && can(user.role, "content:publish");
  const form = useDirtyState<Form>(initial ? toForm(initial) : blank());
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<"title" | "slug" | "date", string>>>({});
  // New posts follow the title for the slug until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  // Navigate once the saved state has rendered, so the unsaved-changes guard has let go.
  useEffect(() => {
    if (moveTo && !form.dirty) navigate(moveTo, { replace: true });
  }, [moveTo, form.dirty, navigate]);
  const v = form.value;
  const set = (patch: Partial<Form>) => form.setValue({ ...form.value, ...patch });
  // Published and scheduled posts are live content: both keep their status when saved.
  const live = saved !== null && saved.status !== "draft";
  const liveStatus: PostStatus = saved?.status ?? "published";
  const locked = !canWrite || (live && !canPublish);

  const validate = () => {
    const next: typeof errors = {};
    if (!v.title.trim()) next.title = "Enter a title.";
    if (!v.slug.trim()) next.slug = "Enter a slug.";
    else if (slugify(v.slug) !== v.slug.trim())
      next.slug = "Use lowercase letters, numbers and hyphens only.";
    if (!v.date) next.date = "Choose a date.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Throws on failure so the unsaved-changes prompt keeps the editor open. */
  const save = async (status: PostStatus) => {
    if (!validate()) throw new Error("invalid");
    const body = {
      title: v.title.trim(),
      slug: v.slug.trim(),
      date: v.date,
      excerpt: v.excerpt.trim() || null,
      body: v.body,
      heroImageUrl: v.heroImageUrl,
      tags: parseTags(v.tags),
      status,
    };
    setSaving(true);
    try {
      const result = saved ? await updatePost(saved.id, body) : await createPost(body);
      setSaved(result);
      form.markSaved();
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setErrors({ slug: "Another post already uses this slug. Make it different." });
      else if (!(err instanceof Error && err.message === "invalid"))
        toast({ variant: "error", title: "Couldn’t save the post", description: "Try again." });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const saveAs = (status: PostStatus, message: string) => async () => {
    let result: PostRecord;
    try {
      result = await save(status);
    } catch {
      return;
    }
    toast({ variant: "success", title: message });
    // A first save moves from /blog/new to the post's own address.
    if (!saved) setMoveTo(postEditPath(result.id));
  };

  const remove = async () => {
    if (!saved) return;
    setSaving(true);
    try {
      await deletePost(saved.id);
      form.markSaved();
      toast({ variant: "success", title: "Post deleted" });
      setMoveTo("/blog");
    } catch {
      toast({ variant: "error", title: "Couldn’t delete the post", description: "Try again." });
    } finally {
      setSaving(false);
      setDeleting(false);
    }
  };

  return (
    <section className="kc-blog kc-blog-editor">
      <EditorContainer
        variant="inline"
        title={saved ? "Editing post" : "New post"}
        subject={v.title || undefined}
        dirty={form.dirty}
        onClose={() => navigate("/blog")}
        headerActions={
          <>
            {saved && <Badge variant={saved.status}>{cap(saved.status)}</Badge>}
            {saved && !locked && (
              <IconButton
                label="Delete post"
                disabled={saving}
                onClick={() => setDeleting(true)}
                icon={
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
                }
              />
            )}
          </>
        }
        actions={
          locked ? undefined : live ? (
            <>
              <Button disabled={saving} onClick={saveAs(liveStatus, "Post saved")}>
                Save changes
              </Button>
              <Button
                variant="tertiary"
                disabled={saving}
                onClick={saveAs(
                  "draft",
                  liveStatus === "scheduled" ? "Post unscheduled" : "Post unpublished",
                )}
              >
                {liveStatus === "scheduled" ? "Unschedule" : "Unpublish"}
              </Button>
            </>
          ) : (
            <>
              {canPublish && (
                <Button disabled={saving} onClick={saveAs("published", "Post published")}>
                  Publish
                </Button>
              )}
              <Button
                variant={canPublish ? "tertiary" : "primary"}
                disabled={saving}
                onClick={saveAs("draft", "Draft saved")}
              >
                Save draft
              </Button>
            </>
          )
        }
      >
        {saved?.status === "scheduled" && saved.publishAt && (
          <Banner variant="info">
            Scheduled to publish on{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: DEFAULT_TIME_ZONE,
            }).format(new Date(saved.publishAt))}{" "}
            (Lagos time). Saving keeps the schedule.
          </Banner>
        )}
        <div className="kc-blog-editor__grid">
          <div className="kc-blog-editor__main">
            <TextField
              label="Title"
              required
              disabled={locked}
              value={v.title}
              error={errors.title}
              onChange={(e) =>
                set({
                  title: e.target.value,
                  ...(!slugTouched && { slug: slugify(e.target.value) }),
                })
              }
            />
            <TextField
              label="Slug"
              required
              disabled={locked}
              help={`The post’s web address: /blog/${v.slug.trim() || "your-slug"}`}
              error={errors.slug}
              value={v.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set({ slug: e.target.value });
              }}
            />
            <TextareaField
              label="Excerpt"
              optional
              rows={3}
              disabled={locked}
              help="A short summary shown in blog lists."
              value={v.excerpt}
              onChange={(e) => set({ excerpt: e.target.value })}
            />
            <div className="kc-blog-editor__body">
              <span className="kc-blog-editor__label" id="kc-blog-body-label">
                Body
              </span>
              <RichTextEditor
                aria-labelledby="kc-blog-body-label"
                value={v.body}
                disabled={locked}
                onChange={(body) => set({ body })}
              />
            </div>
          </div>
          <aside className="kc-blog-editor__side">
            <div className="kc-blog-editor__card">
              <h2>Details</h2>
              <TextField
                label="Date"
                type="date"
                required
                disabled={locked}
                error={errors.date}
                value={v.date}
                onChange={(e) => set({ date: e.target.value })}
              />
              <TextField
                label="Tags"
                optional
                disabled={locked}
                help="Separate with commas."
                value={v.tags}
                onChange={(e) => set({ tags: e.target.value })}
              />
            </div>
            <div className="kc-blog-editor__card">
              <h2>Cover image</h2>
              <ImageUploadField
                label="Cover image"
                value={v.heroImageUrl}
                disabled={locked}
                onChange={(heroImageUrl) => set({ heroImageUrl })}
                help="PNG, JPEG or WebP."
              />
            </div>
          </aside>
        </div>
      </EditorContainer>
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => !open && setDeleting(false)}
        variant="danger"
        busy={saving}
        title="Delete this post?"
        message={
          <>&ldquo;{saved?.title}&rdquo; will be deleted for good. This can&rsquo;t be undone.</>
        }
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </section>
  );
}
