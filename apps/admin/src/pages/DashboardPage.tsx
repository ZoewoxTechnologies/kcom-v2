import { useCallback, useState } from "react";
import { Link } from "react-router";
import { Badge, Banner } from "@kcom/ui";
import { capsuleEditPath, listDrafts } from "../capsules/api";
import type { CapsuleSummary } from "../capsules/api";
import { addDays, lagosDay, shortDayLabel } from "../capsules/days";
import { AsyncPanel, AsyncTile } from "../dashboard/Async";
import {
  loadActivity,
  loadCapsulesOn,
  loadSubscribers,
  loadUpcomingCapsules,
} from "../dashboard/api";
import { activityWhen, comingUp, draftsOf, greeting } from "../dashboard/summary";
import { Panel, PanelRow } from "../dashboard/widgets";
import { upcomingEventsSummary } from "../events/api";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const newCapsulePath = (day: string) => `/capsules/new?day=${day}`;
const DRAFTS_SHOWN = 5;

/**
 * Landing page: today's capsule, what is coming up, drafts and the key numbers. Every tile and
 * panel loads its own data, so a failing request only breaks the one place that asked for it.
 */
export function DashboardPage() {
  // Fixed for this visit, so the loaders below stay stable and nothing refetches on re-render.
  const [now] = useState(() => new Date());
  const today = lagosDay(now);
  const tomorrow = addDays(today, 1);

  return (
    <section className="kc-dash">
      <header className="kc-dash__head">
        <h1>{greeting(now)}</h1>
        <Link className="kc-btn kc-btn--primary" to="/capsules/new">
          New capsule
        </Link>
      </header>

      <div className="kc-dash__stats">
        <SubscribersTile />
        <TomorrowTile tomorrow={tomorrow} />
        <EventsTile />
      </div>
      <div className="kc-dash__panels">
        <ComingUpPanel today={today} />
        <DraftsPanel />
      </div>
      <ActivityPanel now={now} />
    </section>
  );
}

function SubscribersTile() {
  return (
    <AsyncTile label="Subscribers" load={loadSubscribers}>
      {(s) => (
        <>
          <span className="kc-stat__value">{s.confirmed.toLocaleString("en")}</span>
          <span className="kc-stat__note">{`+${s.addedThisMonth.toLocaleString("en")} this month`}</span>
        </>
      )}
    </AsyncTile>
  );
}

/** The tile, plus a heads-up spanning the stats row when tomorrow's capsule is not written. */
function TomorrowTile({ tomorrow }: { tomorrow: string }) {
  const load = useCallback(() => loadCapsulesOn(tomorrow), [tomorrow]);
  return (
    <AsyncTile
      label="Tomorrow’s Capsule"
      load={load}
      after={(capsules) =>
        capsules.length === 0 && (
          <Banner
            className="kc-dash__notice"
            action={
              <Link className="kc-btn kc-btn--tertiary" to={newCapsulePath(tomorrow)}>
                Write it now
              </Link>
            }
          >
            Tomorrow’s Capsule ({shortDayLabel(tomorrow)}) isn’t written yet. It goes live at
            midnight (WAT).
          </Banner>
        )
      }
    >
      {(capsules) => (
        <>
          <span className="kc-stat__value">
            {capsules[0] ? cap(capsules[0].status) : "Not yet"}
          </span>
          <span className="kc-stat__note">Due by midnight WAT</span>
        </>
      )}
    </AsyncTile>
  );
}

function EventsTile() {
  return (
    <AsyncTile label="Upcoming events" load={upcomingEventsSummary}>
      {(events) => (
        <>
          <span className="kc-stat__value">{events.total}</span>
          <span className="kc-stat__note">
            {events.next
              ? `Next: ${shortDayLabel(lagosDay(events.next)).slice(4)}`
              : "None planned"}
          </span>
        </>
      )}
    </AsyncTile>
  );
}

function ComingUpPanel({ today }: { today: string }) {
  const load = useCallback(() => loadUpcomingCapsules(today), [today]);
  const dayName = (day: string) =>
    day === today ? "Today" : shortDayLabel(day).split(" ").slice(0, 2).join(" ");
  return (
    <AsyncPanel title="Coming up" load={load}>
      {(capsules: CapsuleSummary[]) => (
        <Panel title="Coming up">
          {comingUp(capsules, new Date()).map(({ day, capsule }) => (
            <PanelRow
              key={day}
              lead={dayName(day)}
              trail={
                <Badge variant={capsule?.status ?? "missing"}>
                  {capsule ? cap(capsule.status) : "Missing"}
                </Badge>
              }
            >
              {capsule ? (
                <Link to={capsuleEditPath(capsule.id)}>{capsule.title}</Link>
              ) : (
                <Link to={newCapsulePath(day)}>Not written yet</Link>
              )}
            </PanelRow>
          ))}
        </Panel>
      )}
    </AsyncPanel>
  );
}

function DraftsPanel() {
  return (
    <AsyncPanel title="Drafts" load={listDrafts}>
      {(all) => {
        const drafts = draftsOf(all);
        return (
          <Panel title="Drafts" empty="No drafts. Everything is scheduled or published.">
            {drafts.length > 0 &&
              drafts.slice(0, DRAFTS_SHOWN).map((c) => (
                <PanelRow key={c.id} lead={shortDayLabel(lagosDay(c.publishAt)).slice(4)}>
                  <Link to={capsuleEditPath(c.id)}>{c.title}</Link>
                </PanelRow>
              ))}
            {drafts.length > DRAFTS_SHOWN && (
              <p className="kc-panel__more">
                <Link to="/capsules">All {drafts.length} drafts</Link>
              </p>
            )}
          </Panel>
        );
      }}
    </AsyncPanel>
  );
}

function ActivityPanel({ now }: { now: Date }) {
  return (
    <AsyncPanel title="Recent activity" what="recent activity" load={loadActivity}>
      {(items) => (
        <Panel title="Recent activity" empty="Nothing yet.">
          {items.map((a, i) => (
            <PanelRow
              key={`${a.at}-${i}`}
              lead={activityWhen(a.at, now)}
              trail={a.badge && <Badge variant="scheduled">{a.badge}</Badge>}
            >
              {a.href ? <Link to={a.href}>{a.text}</Link> : a.text}
            </PanelRow>
          ))}
        </Panel>
      )}
    </AsyncPanel>
  );
}
