import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  ConfirmDialog,
  SegmentedControl,
  Tooltip,
  UnsavedChangesPrompt,
  DataTable,
  DateTimePicker,
  TextareaField,
  TextField,
  DEFAULT_TIME_ZONE,
  useToast,
} from "@kcom/ui";
import type { DataTableColumn } from "@kcom/ui";
import { EditorContainer, useDirtyState } from "../editor";
import { can } from "@kcom/permissions";
import { ApiError } from "../api/client";
import { slugify } from "@kcom/content";
import { useAuth } from "../auth/AuthProvider";
import {
  createEvent,
  deleteEvent,
  listEvents,
  plainToRichText,
  richTextToPlain,
  updateEvent,
  type EventRecord,
  type EventStatus,
} from "./api";

interface Form {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  place: string;
  description: string;
}

const blank: Form = { title: "", startsAt: null, endsAt: null, place: "", description: "" };

const toForm = (e: EventRecord): Form => ({
  title: e.title,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  place: e.place ?? "",
  description: richTextToPlain(e.description),
});

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: DEFAULT_TIME_ZONE, ...opts }).format(d);

/** "6 Dec 2026", or "12–14 Mar 2027" when it spans days. */
export function formatEventDates(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const day = { day: "numeric", month: "short", year: "numeric" } as const;
  const first = fmt(start, day);
  if (!endsAt) return first;
  const last = fmt(new Date(endsAt), day);
  if (first === last) return first;
  const sameMonth =
    fmt(start, { month: "short", year: "numeric" }) ===
    fmt(new Date(endsAt), { month: "short", year: "numeric" });
  return sameMonth ? `${fmt(start, { day: "numeric" })}–${last}` : `${first} – ${last}`;
}

const isUpcoming = (e: EventRecord, now: number) =>
  new Date(e.endsAt ?? e.startsAt).getTime() >= now;

const statusLabel: Record<EventStatus, string> = { draft: "Draft", published: "Published" };

type When = "upcoming" | "past";

const WHEN_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
] as const;

/** Admin Events: a list beside a side-panel editor. */
export function EventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [when, setWhen] = useState<When>("upcoming");
  /** "new", an event id, or null when nothing is selected. */
  const [selected, setSelected] = useState<string | "new" | null>(null);
  /** The open editor reports its unsaved state here, so switching events can ask first. */
  const guard = useRef<EditorGuard | null>(null);
  const [switchTo, setSwitchTo] = useState<{ target: string | "new" } | null>(null);
  const select = (target: string | "new") => {
    if (target === selected) return;
    if (guard.current?.dirty) setSwitchTo({ target });
    else setSelected(target);
  };
  const [deleting, setDeleting] = useState<EventRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await listEvents());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const shown = (events ?? [])
    .filter((e) => isUpcoming(e, now) === (when === "upcoming"))
    .sort((a, b) => {
      const d = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      return when === "upcoming" ? d : -d;
    });
  const editing = selected && selected !== "new" ? events?.find((e) => e.id === selected) : null;

  const columns: DataTableColumn<EventRecord>[] = [
    {
      key: "date",
      header: "Date",
      width: "9rem",
      render: (e) => formatEventDates(e.startsAt, e.endsAt),
    },
    { key: "title", header: "Event", accessor: (e) => e.title },
    {
      key: "status",
      header: "Status",
      width: "7rem",
      render: (e) => <Badge variant={e.status}>{statusLabel[e.status]}</Badge>,
    },
  ];

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteEvent(deleting.id);
      if (selected === deleting.id) setSelected(null);
      setDeleting(null);
      toast({ variant: "success", title: "Event deleted" });
      await load();
    } catch {
      toast({ variant: "error", title: "Couldn’t delete the event", description: "Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="kc-events">
      <header className="kc-events__head">
        <h1>Events</h1>
        <Button onClick={() => select("new")}>New event</Button>
      </header>
      <div className="kc-events__body">
        <div className="kc-events__list">
          <SegmentedControl
            label="Show"
            className="kc-events__tabs"
            options={WHEN_OPTIONS}
            value={when}
            onChange={setWhen}
          />
          {loadFailed ? (
            <div className="kc-events__error" role="alert">
              <strong>Couldn&rsquo;t load events</strong>
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : events === null ? (
            <p className="kc-events__loading">Loading events…</p>
          ) : (
            <DataTable
              caption="Events"
              columns={columns}
              rows={shown}
              getRowId={(e) => e.id}
              selectedRowId={editing?.id ?? null}
              onRowClick={(e) => select(e.id)}
              emptyTitle={when === "upcoming" ? "No upcoming events" : "No past events"}
              emptyMessage="Create an event to see it here."
            />
          )}
        </div>
        <div className="kc-events__side">
          {selected && (selected === "new" || editing) ? (
            <EventEditor
              key={selected}
              event={editing ?? null}
              guard={guard}
              onClose={() => setSelected(null)}
              onSaved={async () => {
                await load();
              }}
              onDelete={editing ? () => setDeleting(editing) : undefined}
            />
          ) : (
            <aside className="kc-events__empty">
              <h2>No event selected</h2>
              <p>Pick an event on the left to edit it, or start a new one.</p>
              <Button onClick={() => select("new")}>New event</Button>
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
        title="Delete this event?"
        message={
          <>&ldquo;{deleting?.title}&rdquo; will be deleted for good. This can&rsquo;t be undone.</>
        }
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </section>
  );
}

/** What the page needs from the open editor to guard switching events. */
interface EditorGuard {
  dirty: boolean;
  title: string;
}

interface EditorProps {
  guard: { current: EditorGuard | null };
  event: EventRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDelete?: () => void;
}

function EventEditor({ event, guard, onClose, onSaved, onDelete }: EditorProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content:write");
  const canPublish = !!user && can(user.role, "content:publish");
  const form = useDirtyState<Form>(event ? toForm(event) : blank);
  // What the description text was when loaded or last saved. It is only sent when it changes,
  // so rich content written elsewhere is never flattened to plain text by an unrelated edit.
  const [baseDescription, setBaseDescription] = useState(event ? toForm(event).description : "");
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(event);
  const v = form.value;
  const set = (patch: Partial<Form>) => form.setValue({ ...form.value, ...patch });

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!v.title.trim()) next.title = "Enter a title.";
    else if (!slugify(v.title)) next.title = "Use at least one letter or number in the title.";
    if (!v.startsAt) next.startsAt = "Choose a start time.";
    if (v.startsAt && v.endsAt && new Date(v.endsAt) < new Date(v.startsAt))
      next.endsAt = "The end can’t be before the start.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Throws on failure so the unsaved-changes prompt keeps the editor open. */
  const save = async (status: EventStatus) => {
    if (!validate()) throw new Error("invalid");
    const body = {
      title: v.title.trim(),
      startsAt: v.startsAt!,
      endsAt: v.endsAt,
      place: v.place.trim() || null,
      status,
      ...(v.description !== baseDescription && { description: plainToRichText(v.description) }),
    };
    setSaving(true);
    try {
      const result = saved
        ? await updateEvent(saved.id, body)
        : await createEvent({ ...body, slug: slugify(v.title) });
      setSaved(result);
      setBaseDescription(v.description);
      form.markSaved();
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setErrors({ title: "Another event already uses this title. Make it different." });
      else if (!(err instanceof Error && err.message === "invalid"))
        toast({ variant: "error", title: "Couldn’t save the event", description: "Try again." });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const saveAndClose = (status: EventStatus, message: string) => async () => {
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
      title={saved ? "Editing" : "New event"}
      subject={v.title || undefined}
      dirty={form.dirty}
      onClose={onClose}
      headerActions={
        onDelete && canDelete ? (
          <Tooltip label="Delete event">
            <Button
              variant="tertiary"
              className="kc-events__delete"
              aria-label="Delete event"
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
              <Button disabled={saving} onClick={saveAndClose("published", "Event saved")}>
                Save changes
              </Button>
              <Button
                variant="tertiary"
                disabled={saving}
                onClick={saveAndClose("draft", "Event unpublished")}
              >
                Unpublish
              </Button>
            </>
          )}
          {!published && (
            <>
              {canPublish && (
                <Button disabled={saving} onClick={saveAndClose("published", "Event published")}>
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
      <div className="kc-events__form">
        <TextField
          label="Title"
          required
          value={v.title}
          error={errors.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <div className="kc-events__dates">
          <DateTimePicker
            label="Starts"
            value={v.startsAt ? new Date(v.startsAt) : null}
            error={errors.startsAt}
            onChange={(d) => set({ startsAt: d?.toISOString() ?? null })}
          />
          <DateTimePicker
            label="Ends (optional)"
            value={v.endsAt ? new Date(v.endsAt) : null}
            error={errors.endsAt}
            onChange={(d) => set({ endsAt: d?.toISOString() ?? null })}
          />
        </div>
        <p className="kc-events__hint">Times are in Lagos time.</p>
        <TextField
          label="Venue"
          optional
          value={v.place}
          onChange={(e) => set({ place: e.target.value })}
        />
        <TextareaField
          label="Description"
          optional
          rows={5}
          value={v.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>
    </EditorContainer>
  );
}
