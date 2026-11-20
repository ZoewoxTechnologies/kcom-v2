import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DateTimePicker,
  TextareaField,
  TextField,
  DEFAULT_TIME_ZONE,
  useToast,
} from "@kcom/ui";
import type { DataTableColumn } from "@kcom/ui";
import { EditorContainer, useDirtyState } from "../editor";
import {
  ApiError,
  createEvent,
  deleteEvent,
  listEvents,
  plainToRichText,
  richTextToPlain,
  slugify,
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

/** Admin Events: a list beside a side-panel editor. */
export function EventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [when, setWhen] = useState<When>("upcoming");
  /** "new", an event id, or null when nothing is selected. */
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<EventRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await listEvents());
    } catch {
      setEvents([]);
      toast({ variant: "error", title: "Couldn’t load events", description: "Try again." });
    }
  }, [toast]);
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
    { key: "date", header: "Date", render: (e) => formatEventDates(e.startsAt, e.endsAt) },
    { key: "title", header: "Event", accessor: (e) => e.title },
    {
      key: "status",
      header: "Status",
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
        <Button onClick={() => setSelected("new")}>New event</Button>
      </header>
      <div className="kc-events__body">
        <div className="kc-events__list">
          <div className="kc-events__tabs" role="group" aria-label="Show">
            {(["upcoming", "past"] as const).map((w) => (
              <Button
                key={w}
                variant={when === w ? "primary" : "secondary"}
                aria-pressed={when === w}
                onClick={() => setWhen(w)}
              >
                {w === "upcoming" ? "Upcoming" : "Past"}
              </Button>
            ))}
          </div>
          {events === null ? (
            <p className="kc-events__loading">Loading events…</p>
          ) : (
            <DataTable
              caption="Events"
              columns={columns}
              rows={shown}
              getRowId={(e) => e.id}
              selectedRowId={editing?.id ?? null}
              onRowClick={(e) => setSelected(e.id)}
              emptyTitle={when === "upcoming" ? "No upcoming events" : "No past events"}
              emptyMessage="Create an event to see it here."
            />
          )}
        </div>
        <aside className="kc-events__empty" aria-label="Event editor">
          <span aria-hidden="true">📅</span>
          <h2>No event selected</h2>
          <p>Pick an event on the left to edit it, or start a new one.</p>
          <Button onClick={() => setSelected("new")}>New event</Button>
        </aside>
      </div>
      {selected && (selected === "new" || editing) && (
        <EventEditor
          key={selected}
          event={editing ?? null}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            await load();
          }}
          onDelete={editing ? () => setDeleting(editing) : undefined}
        />
      )}
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

interface EditorProps {
  event: EventRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDelete?: () => void;
}

function EventEditor({ event, onClose, onSaved, onDelete }: EditorProps) {
  const { toast } = useToast();
  const form = useDirtyState<Form>(event ? toForm(event) : blank);
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
      description: plainToRichText(v.description),
      status,
    };
    setSaving(true);
    try {
      const result = saved
        ? await updateEvent(saved.id, body)
        : await createEvent({ ...body, slug: slugify(v.title) });
      setSaved(result);
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
  return (
    <EditorContainer
      title={saved ? "Edit event" : "New event"}
      subject={v.title || undefined}
      dirty={form.dirty}
      onClose={onClose}
      onSaveDraft={() => save(published ? "published" : "draft")}
      actions={
        <>
          {published ? (
            <>
              <Button disabled={saving} onClick={saveAndClose("published", "Event saved")}>
                Save changes
              </Button>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={saveAndClose("draft", "Event unpublished")}
              >
                Unpublish
              </Button>
            </>
          ) : (
            <>
              <Button disabled={saving} onClick={saveAndClose("published", "Event published")}>
                Publish
              </Button>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={saveAndClose("draft", "Draft saved")}
              >
                Save draft
              </Button>
            </>
          )}
          {onDelete && (
            <Button variant="secondary" disabled={saving} onClick={onDelete}>
              Delete
            </Button>
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
          <div className="kc-field">
            <DateTimePicker
              label="Starts"
              value={v.startsAt ? new Date(v.startsAt) : null}
              onChange={(d) => set({ startsAt: d?.toISOString() ?? null })}
            />
            {errors.startsAt && (
              <p className="kc-field__error" role="alert">
                {errors.startsAt}
              </p>
            )}
          </div>
          <div className="kc-field">
            <DateTimePicker
              label="Ends (optional)"
              value={v.endsAt ? new Date(v.endsAt) : null}
              onChange={(d) => set({ endsAt: d?.toISOString() ?? null })}
            />
            {errors.endsAt && (
              <p className="kc-field__error" role="alert">
                {errors.endsAt}
              </p>
            )}
          </div>
        </div>
        <p className="kc-events__hint">Times are in WAT.</p>
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
