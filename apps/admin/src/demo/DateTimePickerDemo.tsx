import { useState } from "react";
import { DateTimePicker } from "@kcom/ui";

// Fixed "now" (14 Nov 2026, 10:00 Lagos) so the demo is stable.
const now = new Date("2026-11-14T09:00:00Z");
const scheduledDates = ["2026-11-17", "2026-11-20", "2026-11-25"];
const params = new URLSearchParams(location.search);

export function DateTimePickerDemo() {
  const [value, setValue] = useState<Date | null>(new Date("2026-11-20T05:00:00Z"));
  const [empty, setEmpty] = useState<Date | null>(null);
  return (
    <section style={{ display: "grid", gap: "1.5rem", maxWidth: "22rem", marginTop: "2rem" }}>
      <h2>Date and time picker</h2>
      {/* ?picker=open opens this one on load, for screenshots. */}
      <DateTimePicker
        label="Publish date (selected)"
        value={value}
        onChange={setValue}
        now={now}
        scheduledDates={scheduledDates}
        defaultOpen={params.get("picker") === "open"}
      />
      <DateTimePicker label="Publish date (empty)" value={empty} onChange={setEmpty} now={now} />
      <DateTimePicker
        label="Publish date (disabled)"
        value={value}
        onChange={setValue}
        now={now}
        disabled
      />
    </section>
  );
}
