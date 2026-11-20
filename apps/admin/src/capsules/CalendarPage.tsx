import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Link } from "react-router";
import { Badge, Button, Dialog, DialogActions, TextField, useToast } from "@kcom/ui";
import { capsuleEditPath, rescheduleCapsule, useCapsules } from "./api";
import type { CapsuleSummary } from "./api";
import {
  canScheduleOn,
  firstSchedulableDay,
  lagosDay,
  lagosMidnight,
  monthGrid,
  monthOf,
  monthTitle,
  shiftMonth,
} from "./days";
import type { DayKey } from "./days";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Month calendar of capsules by Lagos day. Scheduled capsules can be dragged to another day. */
export function CalendarPage() {
  const { capsules, state, reload, replace } = useCapsules();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => monthOf(lagosDay(new Date())));
  const [dragId, setDragId] = useState<string | null>(null);
  const [moving, setMoving] = useState<CapsuleSummary | null>(null);
  const [moveDay, setMoveDay] = useState("");
  const today = lagosDay(new Date());

  const byDay = useMemo(() => {
    const map = new Map<DayKey, CapsuleSummary[]>();
    for (const c of capsules) {
      const day = lagosDay(c.publishAt);
      map.set(day, [...(map.get(day) ?? []), c]);
    }
    return map;
  }, [capsules]);

  async function moveTo(capsule: CapsuleSummary, day: DayKey) {
    if (lagosDay(capsule.publishAt) === day) return;
    if (!canScheduleOn(day)) {
      toast({
        variant: "error",
        title: "Pick a day after today",
        description: "Capsules publish at midnight Lagos time.",
      });
      return;
    }
    try {
      replace(await rescheduleCapsule(capsule.id, lagosMidnight(day)));
      toast({
        variant: "success",
        title: "Capsule moved",
        description: `“${capsule.title}” is now scheduled for ${day}.`,
      });
    } catch {
      toast({ variant: "error", title: "Could not reschedule the capsule" });
    }
  }

  const onDrop = (event: DragEvent, day: DayKey) => {
    event.preventDefault();
    const capsule = capsules.find((c) => c.id === dragId);
    setDragId(null);
    if (capsule) void moveTo(capsule, day);
  };

  const cells = monthGrid(month);

  return (
    <section className="kc-cal">
      <header className="kc-cal__head">
        <h1>{monthTitle(month)}</h1>
        <div className="kc-cal__nav">
          <Button
            variant="secondary"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ‹
          </Button>
          <Button variant="secondary" onClick={() => setMonth(monthOf(today))}>
            Today
          </Button>
          <Button
            variant="secondary"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </Button>
          <Link className="kc-cal__list-link" to="/capsules">
            List view
          </Link>
        </div>
      </header>
      <div className="kc-cal__key">
        <strong>Key</strong>
        {(["published", "scheduled", "draft"] as const).map((s) => (
          <Badge key={s} variant={s}>
            {cap(s)}
          </Badge>
        ))}
        <span className="kc-cal__hint">
          Drag a scheduled capsule to another day to reschedule · days are Lagos days
        </span>
      </div>
      {state === "error" && (
        <p role="alert">
          Could not load capsules.{" "}
          <Button variant="secondary" size="sm" onClick={reload}>
            Try again
          </Button>
        </p>
      )}
      <div
        className="kc-cal__grid"
        role="grid"
        aria-label={monthTitle(month)}
        aria-busy={state === "loading"}
      >
        {WEEKDAYS.map((d) => (
          <div key={d} className="kc-cal__dow" role="columnheader">
            {d}
          </div>
        ))}
        {cells.map(({ day, inMonth }) => {
          const items = byDay.get(day) ?? [];
          const empty = inMonth && items.length === 0 && state === "ready";
          return (
            <div
              key={day}
              role="gridcell"
              className="kc-cal__day"
              data-day={day}
              data-outside={!inMonth || undefined}
              data-today={day === today || undefined}
              data-empty={empty || undefined}
              onDragOver={(e) => dragId && inMonth && e.preventDefault()}
              onDrop={(e) => inMonth && onDrop(e, day)}
            >
              <span className="kc-cal__num">{Number(day.slice(8))}</span>
              {items.map((c) => (
                <div key={c.id} className="kc-cal__item">
                  <Link
                    to={capsuleEditPath(c.id)}
                    className={`kc-cal__capsule kc-cal__capsule--${c.status}`}
                    draggable={c.status === "scheduled"}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    title={`${c.title} (${c.status})`}
                  >
                    {c.title}
                    <span className="kc-visually-hidden"> — {c.status}</span>
                  </Link>
                  {c.status === "scheduled" && (
                    <button
                      type="button"
                      className="kc-cal__move"
                      aria-label={`Move ${c.title} to another day`}
                      onClick={() => {
                        setMoving(c);
                        setMoveDay(lagosDay(c.publishAt));
                      }}
                    >
                      Move
                    </button>
                  )}
                </div>
              ))}
              {empty && <span className="kc-cal__gap">No capsule</span>}
            </div>
          );
        })}
      </div>
      {moving && (
        <Dialog
          open
          onOpenChange={(o) => !o && setMoving(null)}
          title="Move capsule"
          description={`“${moving.title}” will publish at midnight Lagos time on the day you choose.`}
        >
          <TextField
            label="Day (Lagos)"
            type="date"
            min={firstSchedulableDay()}
            value={moveDay}
            onChange={(e) => setMoveDay(e.target.value)}
          />
          <DialogActions>
            <Button variant="secondary" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button
              disabled={!moveDay}
              onClick={() => {
                const target = moving;
                setMoving(null);
                void moveTo(target, moveDay);
              }}
            >
              Move
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </section>
  );
}
