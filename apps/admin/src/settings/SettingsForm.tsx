import { useState } from "react";
import { Button, TextField, TextareaField, useToast } from "@kcom/ui";
import { ApiError } from "../api/client";
import { useDirtyState } from "../editor";

export interface FieldSpec {
  key: string;
  label: string;
  type?: "text" | "email" | "url" | "tel" | "textarea";
  help?: string;
}

interface Props {
  title: string;
  fields: readonly FieldSpec[];
  /** Saved values; blank or missing means empty. */
  values: Record<string, string | null>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

const toForm = (fields: readonly FieldSpec[], values: Props["values"]) =>
  Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ""]));

/** Field name to message from the API's validation details (paths look like "social.facebook"). */
function failingFields(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(details)) return out;
  for (const d of details as { path?: string; message?: string }[]) {
    const key = d.path?.split(".").pop();
    if (key) out[key] = d.message ? `Check this value: ${d.message}.` : "Check this value.";
  }
  return out;
}

/** One settings group: its fields and a single Save button. */
export function SettingsForm({ title, fields, values, onSave }: Props) {
  const { toast } = useToast();
  const form = useDirtyState<Record<string, string>>(toForm(fields, values));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(form.value);
      form.markSaved();
      setErrors({});
      toast({ variant: "success", title: "Settings saved" });
    } catch (err) {
      const bad = err instanceof ApiError && err.status < 500 ? failingFields(err.details) : {};
      if (Object.keys(bad).length) setErrors(bad);
      else toast({ variant: "error", title: "Couldn’t save settings", description: "Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="kc-settings__panel"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2>{title}</h2>
      {fields.map((f) => {
        const common = {
          label: f.label,
          optional: true,
          help: f.help,
          error: errors[f.key],
          value: form.value[f.key] ?? "",
          onChange: (e: { target: { value: string } }) =>
            form.setValue({ ...form.value, [f.key]: e.target.value }),
        };
        return f.type === "textarea" ? (
          <TextareaField key={f.key} rows={3} {...common} />
        ) : (
          <TextField key={f.key} type={f.type ?? "text"} {...common} />
        );
      })}
      <div className="kc-settings__actions">
        <Button type="submit" disabled={!form.dirty} loading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}
