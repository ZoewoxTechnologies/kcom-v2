import { useState } from "react";
import {
  Avatar,
  Button,
  ConfirmDialog,
  IconButton,
  TextField,
  TextareaField,
  useToast,
} from "@kcom/ui";
import { EditorContainer, ImageUploadField, useDirtyState } from "../editor";
import {
  createItem,
  deleteItem,
  reorderItems,
  updateItem,
  type ListItem,
  type ListName,
} from "./api";

export interface ListConfig {
  list: ListName;
  /** "team member", "arm". */
  singular: string;
  /** Field shown under the name in the list. */
  subtitleKey: string;
  fields: readonly { key: string; label: string; required?: boolean; textarea?: boolean }[];
  imageKey: string;
  imageLabel: string;
  /** Preview shape of the image, width over height. */
  imageAspectRatio: number;
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
const EDIT = icon("M4 20h4L19 9l-4-4L4 16zM14 6l4 4");
const TRASH = icon("M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5");

interface Props {
  config: ListConfig;
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
}

/** An ordered list that can be added to, edited, reordered and deleted. */
export function OrderedList({ config, items, onChange }: Props) {
  const { toast } = useToast();
  /** "new", an item id, or null. */
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<ListItem | null>(null);
  const [busy, setBusy] = useState(false);
  /** True while a reorder is saving, so a second click can't race its rollback. */
  const [moving, setMoving] = useState(false);
  const current = editing && editing !== "new" ? items.find((i) => i.id === editing) : null;

  const move = async (index: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    onChange(next);
    setMoving(true);
    try {
      onChange(
        await reorderItems(
          config.list,
          next.map((i) => i.id),
        ),
      );
    } catch {
      onChange(items);
      toast({ variant: "error", title: "Couldn’t reorder", description: "Try again." });
    } finally {
      setMoving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteItem(config.list, deleting.id);
      onChange(items.filter((i) => i.id !== deleting.id));
      if (editing === deleting.id) setEditing(null);
      setDeleting(null);
      toast({ variant: "success", title: `Deleted ${config.singular}` });
    } catch {
      toast({
        variant: "error",
        title: `Couldn’t delete the ${config.singular}`,
        description: "Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kc-settings__lists">
      <div className="kc-settings__listhead">
        <Button variant="secondary" onClick={() => setEditing("new")}>
          Add {config.singular}
        </Button>
      </div>
      {editing && (editing === "new" || current) && (
        <ItemEditor
          key={editing}
          config={config}
          item={current ?? null}
          onClose={() => setEditing(null)}
          onSaved={(item) =>
            onChange(current ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item])
          }
        />
      )}
      {items.length === 0 ? (
        <p className="kc-settings__empty">No {config.singular}s yet.</p>
      ) : (
        <ul className="kc-settings__items" aria-label={config.list}>
          {items.map((item, index) => (
            <li key={item.id} className="kc-settings__item">
              <Avatar name={item.name} src={item[config.imageKey] ?? undefined} />
              <div className="kc-settings__itemtext">
                <span>{item.name}</span>
                <span>{item[config.subtitleKey]}</span>
              </div>
              <div className="kc-settings__itemtools">
                <IconButton
                  className="kc-settings__tool"
                  label={`Move ${item.name} up`}
                  icon={UP}
                  disabled={moving || index === 0}
                  onClick={() => void move(index, -1)}
                />
                <IconButton
                  className="kc-settings__tool"
                  label={`Move ${item.name} down`}
                  icon={DOWN}
                  disabled={moving || index === items.length - 1}
                  onClick={() => void move(index, 1)}
                />
                <IconButton
                  className="kc-settings__tool"
                  label={`Edit ${item.name}`}
                  icon={EDIT}
                  onClick={() => setEditing(item.id)}
                />
                <IconButton
                  className="kc-settings__tool"
                  label={`Delete ${item.name}`}
                  icon={TRASH}
                  onClick={() => setDeleting(item)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        variant="danger"
        busy={busy}
        title={`Delete this ${config.singular}?`}
        message={
          <>&ldquo;{deleting?.name}&rdquo; will be deleted for good. This can&rsquo;t be undone.</>
        }
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </div>
  );
}

interface EditorProps {
  config: ListConfig;
  item: ListItem | null;
  onClose: () => void;
  onSaved: (item: ListItem) => void;
}

function ItemEditor({ config, item, onClose, onSaved }: EditorProps) {
  const { toast } = useToast();
  const keys = [...config.fields.map((f) => f.key), config.imageKey];
  const form = useDirtyState<Record<string, string>>(
    Object.fromEntries(keys.map((k) => [k, item?.[k] ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const v = form.value;
  const set = (patch: Record<string, string>) => form.setValue({ ...v, ...patch });

  const save = async () => {
    const next: Record<string, string> = {};
    for (const f of config.fields)
      if (f.required && !v[f.key]?.trim()) next[f.key] = `Enter a ${f.label.toLowerCase()}.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const saved = item
        ? await updateItem(config.list, item.id, v)
        : await createItem(config.list, v);
      form.markSaved();
      onSaved(saved);
      toast({ variant: "success", title: `Saved ${config.singular}` });
      onClose();
    } catch {
      toast({
        variant: "error",
        title: `Couldn’t save the ${config.singular}`,
        description: "Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorContainer
      variant="inline"
      title={item ? "Editing" : `New ${config.singular}`}
      subject={v.name || undefined}
      dirty={form.dirty}
      onClose={onClose}
      actions={
        <Button loading={saving} onClick={() => void save()}>
          Save
        </Button>
      }
    >
      <ImageUploadField
        aspectRatio={config.imageAspectRatio}
        label={config.imageLabel[0]!.toUpperCase() + config.imageLabel.slice(1)}
        value={v[config.imageKey] || null}
        onChange={(url) => set({ [config.imageKey]: url ?? "" })}
      />
      {config.fields.map((f) => {
        const common = {
          label: f.label,
          required: f.required,
          optional: !f.required,
          error: errors[f.key],
          value: v[f.key] ?? "",
          onChange: (e: { target: { value: string } }) => set({ [f.key]: e.target.value }),
        };
        return f.textarea ? (
          <TextareaField key={f.key} rows={4} {...common} />
        ) : (
          <TextField key={f.key} {...common} />
        );
      })}
    </EditorContainer>
  );
}
