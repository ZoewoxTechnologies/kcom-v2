import { useCallback, useEffect, useState } from "react";
import { Banner, Button, SegmentedControl } from "@kcom/ui";
import { fetchSettings, saveGroup, type AllSettings, type GroupName } from "./api";
import { OrderedList, type ListConfig } from "./OrderedList";
import { SettingsForm, type FieldSpec } from "./SettingsForm";

type Section = "bank" | "contact" | "social" | "team" | "arms";

const SECTIONS = [
  { value: "bank", label: "Bank" },
  { value: "contact", label: "Contact" },
  { value: "social", label: "Social" },
  { value: "team", label: "Team" },
  { value: "arms", label: "Arms" },
] as const;

const FORMS: Record<GroupName, { title: string; fields: readonly FieldSpec[] }> = {
  bank: {
    title: "Bank details",
    fields: [
      { key: "bankName", label: "Bank name" },
      { key: "accountName", label: "Account name" },
      { key: "accountNumber", label: "Account number" },
      { key: "sortOrSwift", label: "Sort code or SWIFT" },
    ],
  },
  contact: {
    title: "Contact details",
    fields: [
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "tel" },
      { key: "address", label: "Postal address", type: "textarea" },
    ],
  },
  social: {
    title: "Social links",
    fields: [
      { key: "facebook", label: "Facebook", type: "url" },
      { key: "youtube", label: "YouTube", type: "url" },
      { key: "instagram", label: "Instagram", type: "url" },
      { key: "x", label: "X", type: "url" },
      { key: "whatsappChannel", label: "WhatsApp channel", type: "url" },
      { key: "telegram", label: "Telegram", type: "url" },
    ],
  },
};

const LISTS: Record<"team" | "arms", ListConfig> = {
  team: {
    list: "team",
    singular: "team member",
    subtitleKey: "role",
    imageKey: "portraitUrl",
    imageLabel: "portrait",
    imageAspectRatio: 1,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "role", label: "Role", required: true },
      { key: "bio", label: "Bio", textarea: true },
    ],
  },
  arms: {
    list: "arms",
    singular: "arm",
    subtitleKey: "description",
    imageKey: "imageUrl",
    imageLabel: "image",
    imageAspectRatio: 16 / 9,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "description", label: "Description", textarea: true },
    ],
  },
};

/** Admin Settings: bank, contact, social, team and arms. Admin only (route guard + API). */
export function SettingsPage() {
  const [data, setData] = useState<AllSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<Section>("bank");

  const load = useCallback(async () => {
    try {
      setData(await fetchSettings());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="kc-settings">
      <h1>Settings</h1>
      <SegmentedControl
        label="Section"
        className="kc-settings__tabs"
        options={SECTIONS}
        value={section}
        onChange={setSection}
      />
      {failed ? (
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          Couldn&rsquo;t load settings
        </Banner>
      ) : data === null ? (
        <p className="kc-settings__loading">Loading settings…</p>
      ) : section === "team" || section === "arms" ? (
        <OrderedList
          key={section}
          config={LISTS[section]}
          items={data[section]}
          onChange={(items) => setData({ ...data, [section]: items })}
        />
      ) : (
        <SettingsForm
          key={section}
          title={FORMS[section].title}
          fields={FORMS[section].fields}
          values={data[section]}
          onSave={async (values) => setData(await saveGroup(section, values))}
        />
      )}
    </section>
  );
}
