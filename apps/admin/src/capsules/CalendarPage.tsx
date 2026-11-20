import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Link } from "react-router";
import { can } from "@kcom/permissions";
import { Badge, Button, Dialog, DialogActions, TextField, useToast } from "@kcom/ui";
import { useAuth } from "../auth/AuthProvider";
import { capsuleEditPath, rescheduleCapsule, useCapsules } from "./api";
import type { CapsuleSummary } from "./api";
import {
  canScheduleOn,
  firstSchedulableDay,
  fullDayLabel,
  lagosDay,
  lagosMidnight,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
  shortDayLabel,
} from "./days";
import type { DayKey } from "./days";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const newCapsulePath = (day?: DayKey) =>
  day ? `/capsules/new?day=${day}` : "/capsules/new";

/** Month calendar of capsules by Lagos day. Scheduled capsules can be dragged, or moved by date. */
export function CalendarPage() {
  const { user } = useAuth();
  const canMove = !!user && can(user.role, "content:publish");
  const { toast } = useToast();
  const [month, setMonth] = useState(() => monthOf(lagosDay(new Date())));
  const { capsules, state, reload, replace } = useCapsules(month);
  const [dragId, setDragId] = useState<string | null>(null);
  const [moving, setMoving] = useState<CapsuleSummary | null>(null);
  const [moveDay, setMoveDay] = useState("");
  const today = lagosDay(new Date());
  const minDay = firstSchedulableDay();

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
    const taken = byDay.get(day)?.find((c) => c.id !== capsule.id);
    if (taken) {
      toast({ variant: "error", title: `${shortDayLabel(day)} already has “${taken.title}”` });
      return;
    }
    try {
      replace(await rescheduleCapsule(capsule.id, lagosMidnight(day)));
      toast({
        variant: "success",
        title: "Capsule moved",
        description: `“${capsule.title}” is now scheduled for ${shortDayLabel(day)}.`,
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
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <section className="kc-cal">
      <header className="kc-cal__head">
        <h1>{monthLabel(month)}</h1>
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
          <Link className="kc-btn kc-btn--primary kc-cal__new" to={newCapsulePath()}>
            New capsule
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
        <Link to="/capsules">List view</Link>
        <span className="kc-cal__hint">Drag a capsule to another day to reschedule</span>
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
        role="table"
        aria-label={monthLabel(month)}
        aria-busy={state === "loading"}
      >
        <div className="kc-cal__row" role="row">
          {WEEKDAYS.map((d) => (
            <div key={d} className="kc-cal__dow" role="columnheader">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.day} className="kc-cal__row" role="row">
            {week.map(({ day, inMonth }) => {
              const items = byDay.get(day) ?? [];
              const addable = inMonth && items.length === 0 && state === "ready" && day >= minDay;
              return (
                <div
                  key={day}
                  role="cell"
                  className="kc-cal__day"
                  data-day={day}
                  data-outside={!inMonth || undefined}
                  data-today={day === today || undefined}
                  onDragOver={(e) => dragId && inMonth && e.preventDefault()}
                  onDrop={(e) => inMonth && onDrop(e, day)}
                >
                  {inMonth && (
                    <>
                      <span className="kc-cal__num" aria-hidden="true">
                        {Number(day.slice(8))}
                      </span>
                      <span className="kc-visually-hidden">{fullDayLabel(day)}</span>
                    </>
                  )}
                  {items.map((c) => (
                    <div key={c.id} className="kc-cal__item">
                      <Link
                        to={capsuleEditPath(c.id)}
                        className={`kc-cal__capsule kc-cal__capsule--${c.status}`}
                        draggable={canMove && c.status === "scheduled"}
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => setDragId(null)}
                        title={`${c.title} (${c.status})`}
                      >
                        {c.title}
                        <span className="kc-visually-hidden"> — {c.status}</span>
                      </Link>
                      {canMove && c.status === "scheduled" && (
                        <button
                          type="button"
                          className="kc-cal__move"
                          aria-label={`Move ${c.title} to date`}
                          onClick={() => {
                            setMoving(c);
                            setMoveDay(lagosDay(c.publishAt));
                          }}
                        >
                          Move to date
                        </button>
                      )}
                    </div>
                  ))}
                  {addable && (
                    <Link className="kc-cal__add" to={newCapsulePath(day)}>
                      + Add
                      <span className="kc-visually-hidden"> capsule on {fullDayLabel(day)}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {moving && (
        <Dialog
          open
          onOpenChange={(o) => !o && setMoving(null)}
          title="Move to date"
          description={`“${moving.title}” will publish at midnight Lagos time on the day you choose.`}
        >
          <TextField
            label="Day (Lagos)"
            type="date"
            min={minDay}
            value={moveDay}
            onChange={(e) => setMoveDay(e.target.value)}
          />
          <DialogActions>
            <Button variant="secondary" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button
              disabled={!moveDay || moveDay < minDay}
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
