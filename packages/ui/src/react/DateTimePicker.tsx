import * as Popover from "@radix-ui/react-popover";
import { Button } from "./Button";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  formatLagos,
  fromLagosParts,
  lagosDateKey,
  nextLagosMidnight,
  toLagosParts,
} from "../lib/lagos";

export interface DateTimePickerProps {
  /** Selected instant, or null for none. Shown and edited in Africa/Lagos. */
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** When true and value is null, the picker opens on (and "Next midnight" sets) the next Lagos midnight. */
  defaultNextMidnight?: boolean;
  /** Lagos days ("YYYY-MM-DD") that already have a scheduled item. */
  scheduledDates?: readonly string[];
  /** Current time; override in tests. */
  now?: Date;
  label?: string;
  id?: string;
  disabled?: boolean;
  /** Start with the popover open. */
  defaultOpen?: boolean;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const key = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Date and time picker in a Radix popover. Never allows a time in the past. */
export function DateTimePicker({
  value,
  onChange,
  defaultNextMidnight = true,
  scheduledDates = [],
  now,
  label = "Date and time",
  id,
  disabled,
  defaultOpen = false,
}: DateTimePickerProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const current = now ?? new Date();
  const today = toLagosParts(current);
  const todayKey = key(today.year, today.month, today.day);
  const fallback = defaultNextMidnight ? nextLagosMidnight(current) : current;
  const shown = toLagosParts(value ?? fallback);

  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState({ year: shown.year, month: shown.month });
  const [focusDay, setFocusDay] = useState(shown.day);
  const gridRef = useRef<HTMLDivElement>(null);
  const scheduled = new Set(scheduledDates);

  const clamp = (date: Date) => (date.getTime() < current.getTime() ? nextMinute(current) : date);

  const commit = (parts: Partial<typeof shown>) => {
    const next = fromLagosParts({ ...shown, ...parts });
    onChange(clamp(next));
  };

  const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };
  const isPast = (day: number) => key(view.year, view.month, day) < todayKey;

  const move = (event: KeyboardEvent, delta: number) => {
    event.preventDefault();
    let next = focusDay + delta;
    if (next < 1) {
      shiftMonth(-1);
      next += new Date(Date.UTC(view.year, view.month - 1, 0)).getUTCDate();
    } else if (next > daysInMonth) {
      next -= daysInMonth;
      shiftMonth(1);
    }
    setFocusDay(next);
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus(),
    );
  };

  const onGridKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") move(event, -1);
    else if (event.key === "ArrowRight") move(event, 1);
    else if (event.key === "ArrowUp") move(event, -7);
    else if (event.key === "ArrowDown") move(event, 7);
  };

  const pickDay = (day: number) => {
    if (isPast(day)) return;
    commit({ year: view.year, month: view.month, day });
  };

  const timeValue = `${String(shown.hour).padStart(2, "0")}:${String(shown.minute).padStart(2, "0")}`;
  const minTime =
    key(shown.year, shown.month, shown.day) === todayKey
      ? `${String(today.hour).padStart(2, "0")}:${String(today.minute).padStart(2, "0")}`
      : undefined;

  return (
    <div className="kc-datetime">
      <label className="kc-datetime__label" htmlFor={triggerId}>
        {label}
      </label>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setView({ year: shown.year, month: shown.month });
            setFocusDay(shown.day);
          }
          setOpen(next);
        }}
      >
        <Popover.Trigger asChild>
          <button type="button" id={triggerId} className="kc-datetime__trigger" disabled={disabled}>
            <span>{value ? formatLagos(value) : "Choose date and time"}</span>
            <span aria-hidden="true" className="kc-datetime__icon">
              ▾
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="kc-datetime__panel"
            align="start"
            sideOffset={6}
            aria-label={`${label}, Lagos time`}
          >
            <div className="kc-datetime__head">
              <button
                type="button"
                className="kc-datetime__nav"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <div className="kc-datetime__month" aria-live="polite">
                {MONTHS[view.month - 1]} {view.year}
              </div>
              <button
                type="button"
                className="kc-datetime__nav"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
            <div
              role="grid"
              aria-label={`${MONTHS[view.month - 1]} ${view.year}`}
              ref={gridRef}
              onKeyDown={onGridKey}
            >
              <div role="row" className="kc-datetime__row">
                {WEEKDAYS.map((w) => (
                  <span key={w} role="columnheader" className="kc-datetime__dow">
                    {w}
                  </span>
                ))}
              </div>
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => (
                <div role="row" className="kc-datetime__row" key={r}>
                  {cells.slice(r * 7, r * 7 + 7).map((day, c) => {
                    if (day === null) return <span role="gridcell" key={c} />;
                    const k = key(view.year, view.month, day);
                    const past = isPast(day);
                    const selected = value !== null && lagosDateKey(value) === k;
                    const has = scheduled.has(k);
                    return (
                      <span role="gridcell" key={c} aria-selected={selected}>
                        <button
                          type="button"
                          className="kc-datetime__day"
                          tabIndex={day === focusDay ? 0 : -1}
                          aria-disabled={past || undefined}
                          aria-current={k === todayKey ? "date" : undefined}
                          data-selected={selected || undefined}
                          data-scheduled={has || undefined}
                          aria-label={`${day} ${MONTHS[view.month - 1]} ${view.year}${has ? ", has a scheduled item" : ""}${past ? ", unavailable" : ""}`}
                          onClick={() => pickDay(day)}
                        >
                          {day}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="kc-datetime__foot">
              <label className="kc-datetime__time">
                <span>Time (Lagos)</span>
                <input
                  type="time"
                  value={timeValue}
                  min={minTime}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (h === undefined || m === undefined || Number.isNaN(h)) return;
                    commit({ hour: h, minute: m });
                  }}
                />
              </label>
              {defaultNextMidnight && (
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => onChange(nextLagosMidnight(current))}
                >
                  Next midnight
                </Button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function nextMinute(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / 60000) * 60000);
}
