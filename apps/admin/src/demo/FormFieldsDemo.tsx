import { Checkbox, Fieldset, Radio, SelectField, TextField, TextareaField } from "@kcom/ui";

const columns = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
  gap: "2rem",
  marginTop: "2rem",
} as const;
const column = { display: "flex", flexDirection: "column", gap: "1rem" } as const;

/** Every form field state, for visual review. */
export function FormFieldsDemo() {
  return (
    <section aria-label="Form fields demo" style={columns}>
      <div style={column}>
        <TextField label="Your name" required placeholder="Default (required)" />
        <TextField label="Focused" defaultValue="Grace Adeyemi" autoFocus />
        <TextField label="Phone" optional help="Only used if you ask us to call." />
        <TextField
          label="Email address"
          defaultValue="grace@"
          error="Please enter a full email address."
        />
        <TextField label="Disabled" defaultValue="Locked" disabled />
        <TextareaField label="Message" placeholder="I'd like to request prayer for…" />
      </div>
      <div style={column}>
        <SelectField label="Topic">
          <option>Prayer request</option>
          <option>Question</option>
        </SelectField>
        <SelectField label="Select with error" error="Pick a topic.">
          <option>Choose…</option>
        </SelectField>
        <SelectField label="Select disabled" disabled>
          <option>Prayer request</option>
        </SelectField>
        <Checkbox label="Keep my request private" defaultChecked />
        <Checkbox label="Send me the daily capsule" />
        <Checkbox label="Disabled option" disabled />
        <Fieldset legend="Radio">
          <Radio name="contact" label="Email" defaultChecked />
          <Radio name="contact" label="Phone" />
          <Radio name="contact" label="Post" disabled />
        </Fieldset>
        <Fieldset legend="I'm writing about (pill)">
          <Radio name="topic" label="A question" pill />
          <Radio name="topic" label="A prayer request" pill defaultChecked />
          <Radio name="topic" label="Other" pill disabled />
        </Fieldset>
      </div>
    </section>
  );
}
