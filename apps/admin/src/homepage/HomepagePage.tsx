import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Banner, Button, IconButton, Switch, UnsavedChangesPrompt, useToast } from "@kcom/ui";
import { can } from "@kcom/permissions";
import { useAuth } from "../auth/AuthProvider";
import { useDirtyState, useEditorGuard } from "../editor";
import { fetchLayout, saveLayout } from "./api";
import {
  FIXED_KEY,
  SECTION_LABELS,
  moveSection,
  setVisible,
  type SectionKey,
  type SectionRow,
} from "./layout";

const GRIP = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
const LOCK = (
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
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/** Admin Homepage: reorder (drag or arrow keys) and hide the homepage sections. */
export function HomepagePage() {
  const { user } = useAuth();
  const canEdit = !!user && can(user.role, "content:publish");
  const [loaded, setLoaded] = useState<SectionRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoaded(await fetchLayout());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (failed)
    return (
      <section className="kc-home">
        <h1>Homepage sections</h1>
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          Couldn&rsquo;t load the homepage layout
        </Banner>
      </section>
    );
  if (!loaded) return <p className="kc-admin-loading">Loading homepage sections…</p>;
  return <Builder initial={loaded} canEdit={canEdit} />;
}

function Builder({ initial, canEdit }: { initial: SectionRow[]; canEdit: boolean }) {
  const { toast } = useToast();
  const form = useDirtyState<SectionRow[]>(initial);
  const rows = form.value;
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [dragKey, setDragKey] = useState<SectionKey | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusKey = useRef<SectionKey | null>(null);
  const { blocker, allowNavigation } = useEditorGuard(form.dirty);
  const blocked = blocker.state === "blocked";

  const fixed = rows.find((r) => r.key === FIXED_KEY)!;
  const movable = rows.filter((r) => r.key !== FIXED_KEY);

  // Keep keyboard focus on the handle that just moved.
  useEffect(() => {
    const key = focusKey.current;
    if (!key) return;
    focusKey.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-handle="${key}"]`)?.focus();
  });

  const move = (key: SectionKey, to: number, keepFocus: boolean) => {
    const next = moveSection(rows, key, to);
    if (next === rows) return;
    form.setValue(next);
    if (keepFocus) focusKey.current = key;
    const position = next.findIndex((r) => r.key === key) + 1;
    setAnnounce(`${SECTION_LABELS[key]} moved to position ${position} of ${next.length}`);
  };

  const onKeyDown = (event: KeyboardEvent, key: SectionKey, index: number) => {
    if (!canEdit) return;
    if (event.key === "ArrowUp") move(key, index - 1, true);
    else if (event.key === "ArrowDown") move(key, index + 1, true);
    else return;
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragKey || !listRef.current) return;
    const items = [...listRef.current.querySelectorAll<HTMLElement>("[data-row]")];
    let to = items.length - 1;
    for (const [i, el] of items.entries()) {
      const box = el.getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) {
        to = i;
        break;
      }
    }
    move(dragKey, to, false);
  };

  const save = async () => {
    setSaving(true);
    try {
      form.markSaved(await saveLayout(rows));
      toast({ variant: "success", title: "Homepage updated" });
    } catch {
      toast({ variant: "error", title: "Couldn’t save the layout", description: "Try again." });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    allowNavigation();
    blocker.proceed?.();
  };

  return (
    <section className="kc-home">
      <div className="kc-home__head">
        <h1>Homepage sections</h1>
        {canEdit && (
          <div className="kc-home__tools">
            {form.dirty && <span className="kc-home__status">Unsaved changes</span>}
            <Button disabled={!form.dirty} loading={saving} onClick={() => void save()}>
              Publish
            </Button>
          </div>
        )}
      </div>
      {canEdit ? (
        <p className="kc-home__hint" id="kc-home-hint">
          Drag the handle to reorder, or focus it and use the up and down arrow keys. Switch a
          section off to hide it from the site.
        </p>
      ) : (
        <Banner variant="info">You don’t have permission to change the homepage layout.</Banner>
      )}
      <ul className="kc-home__list" ref={listRef} aria-label="Homepage sections">
        <li className="kc-home__row" data-visible="true">
          <span className="kc-home__lock">{LOCK}</span>
          <span className="kc-home__name">{SECTION_LABELS[fixed.key]}</span>
          <span className="kc-home__note">Fixed at top</span>
        </li>
        {movable.map((row, index) => (
          <li
            key={row.key}
            className="kc-home__row"
            data-row
            data-visible={row.visible}
            data-dragging={dragKey === row.key}
          >
            <IconButton
              className="kc-home__handle"
              data-handle={row.key}
              label={`Reorder ${SECTION_LABELS[row.key]}`}
              icon={GRIP}
              disabled={!canEdit}
              aria-describedby="kc-home-hint"
              onKeyDown={(e) => onKeyDown(e, row.key, index)}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setDragKey(row.key);
              }}
              onPointerMove={onPointerMove}
              onPointerUp={() => setDragKey(null)}
              onPointerCancel={() => setDragKey(null)}
            />
            <span className="kc-home__name">{SECTION_LABELS[row.key]}</span>
            <span className="kc-home__note">{row.visible ? "" : "Hidden"}</span>
            <Switch
              label={`Show ${SECTION_LABELS[row.key]}`}
              checked={row.visible}
              disabled={!canEdit}
              onChange={(visible) => form.setValue(setVisible(rows, row.key, visible))}
            />
          </li>
        ))}
      </ul>
      <p className="kc-visually-hidden" role="status" aria-live="polite">
        {announce}
      </p>
      <UnsavedChangesPrompt
        open={blocked}
        onOpenChange={(open) => !open && blocker.reset?.()}
        subject="the homepage layout"
        onKeepEditing={() => blocker.reset?.()}
        onDiscard={discard}
      />
    </section>
  );
}
