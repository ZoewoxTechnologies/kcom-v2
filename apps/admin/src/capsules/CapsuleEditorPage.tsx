import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  Badge,
  Banner,
  Button,
  DateTimePicker,
  Field,
  Menu,
  MenuItem,
  SelectField,
  TextareaField,
  TextField,
  UnsavedChangesPrompt,
  useToast,
} from "@kcom/ui";
import { CAPSULE_LIMITS, lagosDate, nextLagosMidnight, slugify } from "@kcom/content";
import { can } from "@kcom/permissions";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useDirtyState, useEditorGuard } from "../editor";
import { plainToRichText, richTextToPlain } from "../richtext/plainText";
import { RichTextEditor, emptyRichText } from "../richtext/RichTextEditor";
import type { RichTextDoc } from "../richtext/RichTextEditor";
import {
  createCapsule,
  createSeries,
  getCapsule,
  listCapsules,
  listSeries,
  updateCapsule,
} from "./api";
import type { CapsuleInput, CapsuleRecord, CapsuleStatus, SeriesSummary } from "./api";
import { lagosMidnight } from "./days";

const NEW_SERIES = "__new";

interface Form {
  title: string;
  scriptureRef: string;
  scriptureText: string;
  body: RichTextDoc;
  decrees: string;
  prayer: string;
  bibleMeditation: string;
  authorSource: string;
  /** A series id, NEW_SERIES, or "" for none. */
  seriesId: string;
  newSeriesTitle: string;
  partNumber: string;
  publishAt: string | null;
}

type Errors = Partial<Record<keyof Form, string>>;

const toForm = (c: CapsuleRecord): Form => ({
  title: c.title,
  scriptureRef: c.scriptureRef ?? "",
  scriptureText: richTextToPlain(c.scriptureText),
  body: c.body,
  decrees: c.decrees.join("\n"),
  prayer: richTextToPlain(c.prayer),
  bibleMeditation: c.bibleMeditation ?? "",
  authorSource: c.authorSource ?? "",
  seriesId: c.seriesId ?? "",
  newSeriesTitle: "",
  partNumber: c.partNumber ? String(c.partNumber) : "",
  publishAt: c.publishAt,
});

/** A new capsule goes live at the next Lagos midnight, or at the start of the day chosen on the calendar. */
function defaultPublishAt(day: string | null): string {
  const now = new Date();
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const start = lagosMidnight(day);
    if (start > now) return start.toISOString();
  }
  return nextLagosMidnight(now).toISOString();
}

const blank = (day: string | null): Form => ({
  title: "",
  scriptureRef: "",
  scriptureText: "",
  body: emptyRichText,
  decrees: "",
  prayer: "",
  bibleMeditation: "",
  authorSource: "",
  seriesId: "",
  newSeriesTitle: "",
  partNumber: "",
  publishAt: defaultPublishAt(day),
});

/** True when the document has any text or an image. */
function hasContent(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "image") return true;
  if (n.type === "text") return !!n.text?.trim();
  return (n.content ?? []).some(hasContent);
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const statusLabel: Record<CapsuleStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};

/** "just now", "2 min ago", "3 hours ago" or the date. */
function savedAgo(at: Date, now: number): string {
  const mins = Math.max(0, Math.round((now - at.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return `on ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(at)}`;
}

const whenFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Editor for one capsule: `/capsules/new` (optionally `?day=`) and `/capsules/:id`. */
export function CapsuleEditorPage({ isNew = false }: { isNew?: boolean }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [capsule, setCapsule] = useState<CapsuleRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "missing">(
    isNew ? "ready" : "loading",
  );
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (isNew || !id) return;
    setState("loading");
    getCapsule(id).then(
      (c) => {
        setCapsule(c);
        setState("ready");
      },
      (err) => setState(err instanceof ApiError && err.status === 404 ? "missing" : "error"),
    );
  }, [id, isNew, reload]);

  return (
    <section className="kc-capsule-editor">
      {state !== "ready" && (
        <header className="kc-capsule-editor__head">
          <h1>{isNew ? "New capsule" : "Edit capsule"}</h1>
        </header>
      )}
      {state === "loading" && <p className="kc-admin-loading">Loading capsule…</p>}
      {state === "missing" && <Banner variant="danger">This capsule doesn&rsquo;t exist.</Banner>}
      {state === "error" && (
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          }
        >
          Could not load the capsule.
        </Banner>
      )}
      {state === "ready" && (
        <CapsuleForm
          key={capsule?.id ?? "new"}
          capsule={capsule}
          day={params.get("day")}
          isNew={isNew}
        />
      )}
    </section>
  );
}

function CapsuleForm({
  capsule,
  day,
  isNew,
}: {
  capsule: CapsuleRecord | null;
  day: string | null;
  isNew: boolean;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content:write");
  const canPublish = !!user && can(user.role, "content:publish");

  const form = useDirtyState<Form>(capsule ? toForm(capsule) : blank(day));
  const [saved, setSaved] = useState(capsule);
  // Plain-text fields are only sent when changed, so rich content written elsewhere is never flattened.
  const [base, setBase] = useState(() =>
    capsule ? toForm(capsule) : { scriptureText: "", prayer: "" },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(capsule ? new Date(capsule.updatedAt) : null);
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [takenDays, setTakenDays] = useState<string[]>([]);
  const redirect = useRef(false);
  // Re-rendered every minute so "Saved N min ago" keeps counting.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    listSeries().then(setSeries, () => setSeries([]));
    listCapsules().then(
      (all) =>
        setTakenDays(
          all
            .filter((c) => c.status !== "draft" && c.id !== capsule?.id)
            .map((c) => lagosDate(new Date(c.publishAt))),
        ),
      () => setTakenDays([]),
    );
  }, [capsule?.id]);

  const v = form.value;
  const set = (patch: Partial<Form>) => form.setValue({ ...form.value, ...patch });
  const status: CapsuleStatus = saved?.status ?? "draft";

  const validate = (target: CapsuleStatus): boolean => {
    const next: Errors = {};
    if (!v.title.trim()) next.title = "Enter a title.";
    else if (!slugify(v.title)) next.title = "Use at least one letter or number in the title.";
    if (v.scriptureRef.length > CAPSULE_LIMITS.scriptureRef)
      next.scriptureRef = `Keep it under ${CAPSULE_LIMITS.scriptureRef} characters.`;
    if (v.bibleMeditation.length > CAPSULE_LIMITS.bibleMeditation)
      next.bibleMeditation = `Keep it under ${CAPSULE_LIMITS.bibleMeditation} characters.`;
    if (v.authorSource.length > CAPSULE_LIMITS.authorSource)
      next.authorSource = `Keep it under ${CAPSULE_LIMITS.authorSource} characters.`;
    if (v.seriesId === NEW_SERIES && !v.newSeriesTitle.trim())
      next.newSeriesTitle = "Enter a name for the new series.";
    if (v.partNumber.trim()) {
      if (!v.seriesId) next.partNumber = "Choose a series first.";
      else if (!/^[1-9]\d*$/.test(v.partNumber.trim()))
        next.partNumber = "Enter a whole number, 1 or more.";
    }
    if (target !== "draft" && !hasContent(v.body))
      next.body = "Write the capsule before scheduling or publishing it.";
    if (target === "scheduled") {
      if (!v.publishAt) next.publishAt = "Choose when it goes live.";
      else if (new Date(v.publishAt) <= new Date()) next.publishAt = "Choose a time in the future.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Throws on failure so the editor stays open. */
  const save = async (target: CapsuleStatus, opts: { now?: boolean } = {}) => {
    if (!validate(target)) throw new Error("invalid");
    setSaving(true);
    // Set once the series step has reported its own error, so the capsule handler leaves it be.
    let seriesHandled = false;
    try {
      let seriesId: string | null = v.seriesId || null;
      if (v.seriesId === NEW_SERIES) {
        try {
          const created = await createSeries(v.newSeriesTitle.trim());
          setSeries((all) => [...all, created]);
          seriesId = created.id;
          // Pick it now, so a failed capsule save can be retried without creating the series again.
          form.setValue({ ...form.value, seriesId: created.id, newSeriesTitle: "" });
        } catch (err) {
          seriesHandled = true;
          if (err instanceof ApiError && err.status === 409)
            setErrors({
              newSeriesTitle:
                "A series with this name already exists. Choose it from the list or pick another name.",
            });
          else
            toast({
              variant: "error",
              title: "Couldn’t create the series",
              description: "Try again.",
            });
          throw err;
        }
      }
      const body: CapsuleInput = {
        title: v.title.trim(),
        scriptureRef: v.scriptureRef.trim() || null,
        decrees: lines(v.decrees),
        bibleMeditation: v.bibleMeditation.trim() || null,
        authorSource: v.authorSource.trim() || null,
        seriesId,
        partNumber: seriesId && v.partNumber.trim() ? Number(v.partNumber) : null,
        status: target,
        ...(!opts.now && v.publishAt && { publishAt: v.publishAt }),
        ...((!saved || v.scriptureText !== base.scriptureText) && {
          scriptureText: plainToRichText(v.scriptureText),
        }),
        ...((!saved || v.prayer !== base.prayer) && { prayer: plainToRichText(v.prayer) }),
        body: v.body,
      };
      const result = saved
        ? await updateCapsule(saved.id, body)
        : await createCapsule({ ...body, slug: slugify(v.title) });
      const next = { ...toForm(result), newSeriesTitle: "" };
      setSaved(result);
      setBase(next);
      setSavedAt(new Date());
      form.markSaved(next);
      setErrors({});
      return result;
    } catch (err) {
      if (seriesHandled) throw err;
      if (err instanceof ApiError && err.status === 409) {
        if (err.code === "day_taken") setErrors({ publishAt: err.message });
        else setErrors({ title: "Another capsule already uses this title. Make it different." });
      } else if (err instanceof ApiError && err.status === 422) {
        setErrors({ publishAt: err.message });
      } else if (!(err instanceof Error && err.message === "invalid")) {
        toast({ variant: "error", title: "Couldn’t save the capsule", description: "Try again." });
      }
      throw err;
    } finally {
      setSaving(false);
    }
  };

  /** Saves with `target`, then either stays (`stay`) or goes back to the list. */
  const { blocker, allowNavigation } = useEditorGuard(form.dirty);
  const run =
    (target: CapsuleStatus, message: string, opts: { stay?: boolean; now?: boolean } = {}) =>
    async () => {
      let result: CapsuleRecord;
      try {
        result = await save(target, opts);
      } catch {
        return;
      }
      toast({ variant: "success", title: message });
      if (opts.stay) {
        // A new capsule moves to its own address once the form is clean again.
        if (!capsule) redirect.current = true;
        setSaved(result);
      } else {
        allowNavigation();
        navigate("/capsules");
      }
    };

  useEffect(() => {
    if (redirect.current && !form.dirty && saved) {
      redirect.current = false;
      navigate(`/capsules/${saved.id}`, { replace: true });
    }
  });

  const primary = (label: string, target: CapsuleStatus, message: string, opts = {}) => (
    <Button disabled={saving} onClick={run(target, message, opts)}>
      {label}
    </Button>
  );
  const secondary = (label: string, target: CapsuleStatus, message: string, opts = {}) => (
    <Button variant="tertiary" disabled={saving} onClick={run(target, message, opts)}>
      {label}
    </Button>
  );

  const more = (items: ReactNode) => (
    <Menu
      trigger="⋯"
      triggerVariant="tertiary"
      triggerClassName="kc-capsule-editor__more"
      triggerLabel="More actions"
      hideChevron
      align="start"
    >
      {items}
    </Menu>
  );
  const item = (label: string, target: CapsuleStatus, message: string, opts = {}) => (
    <MenuItem disabled={saving} onClick={() => void run(target, message, opts)()}>
      {label}
    </MenuItem>
  );

  // The API lets only people who can publish change scheduled or published capsules.
  const locked = status !== "draft" && !canPublish;
  const actions =
    !canWrite || locked ? null : status === "published" ? (
      <>
        {primary("Save changes", "published", "Capsule saved", { stay: true })}
        {secondary("Unpublish", "draft", "Capsule unpublished", { stay: true })}
      </>
    ) : status === "scheduled" ? (
      <>
        {primary("Save changes", "scheduled", "Capsule saved", { stay: true })}
        {secondary("Unschedule", "draft", "Capsule moved to drafts", { stay: true })}
        {more(item("Publish now", "published", "Capsule published", { now: true }))}
      </>
    ) : (
      <>
        {canPublish && primary("Schedule", "scheduled", "Capsule scheduled")}
        {canPublish
          ? secondary("Save draft", "draft", "Draft saved", { stay: true })
          : primary("Save draft", "draft", "Draft saved", { stay: true })}
        {canPublish && more(item("Publish now", "published", "Capsule published", { now: true }))}
      </>
    );

  const publishAt = v.publishAt ? new Date(v.publishAt) : null;
  const seriesTitle = series.find((s) => s.id === v.seriesId)?.title;

  return (
    <>
      <header className="kc-capsule-editor__head">
        <h1>{isNew ? "New capsule" : "Edit capsule"}</h1>
        <div className="kc-capsule-editor__actions">
          <Badge variant={status}>{statusLabel[status]}</Badge>
          {savedAt && (
            <span className="kc-capsule-editor__saved" role="status">
              Saved {savedAgo(savedAt, now)}
            </span>
          )}
          {actions}
        </div>
      </header>
      {locked && (
        <Banner variant="info">
          This capsule is {status}. Only people who can publish can change it.
        </Banner>
      )}
      <div className="kc-capsule-editor__layout">
        <div className="kc-capsule-editor__main">
          <TextField
            className="kc-capsule-editor__title"
            label="Title"
            required
            maxLength={CAPSULE_LIMITS.title + 50}
            value={v.title}
            error={errors.title}
            onChange={(e) => set({ title: e.target.value })}
          />
          <div className="kc-capsule-editor__scripture">
            <TextField
              label="Scripture reference"
              optional
              value={v.scriptureRef}
              error={errors.scriptureRef}
              onChange={(e) => set({ scriptureRef: e.target.value })}
            />
            <TextareaField
              label="Verse text (KJV)"
              optional
              rows={2}
              value={v.scriptureText}
              onChange={(e) => set({ scriptureText: e.target.value })}
            />
          </div>
          <Field label="Body" required error={errors.body}>
            {(control) => (
              <RichTextEditor
                aria-labelledby={undefined}
                aria-label="Body"
                aria-describedby={control["aria-describedby"]}
                aria-invalid={control["aria-invalid"]}
                value={v.body}
                onChange={(body) => set({ body })}
                placeholder="Continue writing…"
              />
            )}
          </Field>
          <TextareaField
            label="Decrees"
            optional
            rows={3}
            help="One per line. Leave blank and the section is hidden on the capsule page."
            value={v.decrees}
            onChange={(e) => set({ decrees: e.target.value })}
          />
          <TextareaField
            label="Prayer / confession"
            optional
            rows={3}
            value={v.prayer}
            onChange={(e) => set({ prayer: e.target.value })}
          />
          <TextField
            label="Bible meditation"
            optional
            intro="Passages to read and meditate on today."
            value={v.bibleMeditation}
            error={errors.bibleMeditation}
            onChange={(e) => set({ bibleMeditation: e.target.value })}
          />
          <TextField
            label="Author / source"
            optional
            value={v.authorSource}
            error={errors.authorSource}
            onChange={(e) => set({ authorSource: e.target.value })}
          />
        </div>
        <div className="kc-capsule-editor__side">
          <section className="kc-capsule-editor__card" aria-labelledby="kc-capsule-publishing">
            <h2 id="kc-capsule-publishing">Publishing</h2>
            <DateTimePicker
              label="Publishes on"
              value={publishAt}
              error={errors.publishAt}
              scheduledDates={takenDays}
              disabled={status === "published"}
              onChange={(d) => set({ publishAt: d?.toISOString() ?? null })}
            />
            <p className="kc-capsule-editor__hint">
              {publishAt ? `${whenFormat.format(publishAt)} WAT. ` : ""}Defaults to the next
              midnight, Nigerian time. Pick a later date to write a few days ahead.
            </p>
            <p className="kc-capsule-editor__note">
              {status === "published" ? (
                <>
                  Status: <strong>Published</strong>. Edits show on the site as soon as you save.
                </>
              ) : (
                <>
                  Status after scheduling: <strong>Scheduled</strong>, then{" "}
                  <strong>Published</strong> automatically at that time.
                </>
              )}
            </p>
          </section>
          <section className="kc-capsule-editor__card" aria-labelledby="kc-capsule-series">
            <h2 id="kc-capsule-series">Series</h2>
            <SelectField
              label="Series"
              optional
              value={v.seriesId}
              onChange={(e) =>
                set({
                  seriesId: e.target.value,
                  ...(e.target.value ? {} : { partNumber: "", newSeriesTitle: "" }),
                })
              }
            >
              <option value="">None</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
              <option value={NEW_SERIES}>New series…</option>
            </SelectField>
            {v.seriesId === NEW_SERIES && (
              <TextField
                label="New series name"
                required
                value={v.newSeriesTitle}
                error={errors.newSeriesTitle}
                onChange={(e) => set({ newSeriesTitle: e.target.value })}
              />
            )}
            {v.seriesId && (
              <TextField
                label="Part number"
                optional
                inputMode="numeric"
                help={seriesTitle ? `Which part of “${seriesTitle}” this is.` : undefined}
                value={v.partNumber}
                error={errors.partNumber}
                onChange={(e) => set({ partNumber: e.target.value })}
              />
            )}
          </section>
        </div>
      </div>
      <UnsavedChangesPrompt
        open={blocker.state === "blocked"}
        onOpenChange={(open) => !open && blocker.reset?.()}
        subject={v.title || undefined}
        onKeepEditing={() => blocker.reset?.()}
        onDiscard={() => {
          allowNavigation();
          blocker.proceed?.();
        }}
      />
    </>
  );
}
