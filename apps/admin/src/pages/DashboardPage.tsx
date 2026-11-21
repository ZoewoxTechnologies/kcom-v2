import { Link } from "react-router";
import { Badge, Banner, Button } from "@kcom/ui";
import { capsuleEditPath } from "../capsules/api";
import { addDays, lagosDay, shortDayLabel } from "../capsules/days";
import { useDashboard } from "../dashboard/api";
import { activityWhen, comingUp, draftsOf, greeting } from "../dashboard/summary";
import { Panel, PanelRow, StatTile } from "../dashboard/widgets";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const newCapsulePath = (day: string) => `/capsules/new?day=${day}`;
const DRAFTS_SHOWN = 5;

/** Landing page: today's capsule, what is coming up, drafts and the key numbers. */
export function DashboardPage() {
  const { data, state, reload } = useDashboard();
  const now = new Date();
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

      {state === "loading" && <p className="kc-admin-loading">Loading…</p>}
      {state === "error" && (
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={reload}>
              Try again
            </Button>
          }
        >
          The dashboard could not be loaded.
        </Banner>
      )}
      {data && <Loaded data={data} now={now} today={today} tomorrow={tomorrow} />}
    </section>
  );
}

function Loaded({
  data,
  now,
  today,
  tomorrow,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>;
  now: Date;
  today: string;
  tomorrow: string;
}) {
  const days = comingUp(data.capsules, now);
  const tomorrowCapsule = days.find((d) => d.day === tomorrow)?.capsule ?? null;
  const drafts = draftsOf(data.drafts);
  const dayName = (day: string) =>
    day === today ? "Today" : shortDayLabel(day).split(" ").slice(0, 2).join(" ");

  return (
    <>
      <div className="kc-dash__stats">
        <StatTile
          label="Subscribers"
          value={data.subscribers.confirmed.toLocaleString("en")}
          note={`+${data.subscribers.addedThisMonth.toLocaleString("en")} this month`}
        />
        <StatTile
          label="Tomorrow’s Capsule"
          value={tomorrowCapsule ? cap(tomorrowCapsule.status) : "Not yet"}
          note="Due by midnight WAT"
        />
        <StatTile
          label="Upcoming events"
          value={data.events.total}
          note={
            data.events.next
              ? `Next: ${shortDayLabel(lagosDay(data.events.next)).slice(4)}`
              : "None planned"
          }
        />
      </div>

      {!tomorrowCapsule && (
        <Banner
          action={
            <Link className="kc-btn kc-btn--tertiary" to={newCapsulePath(tomorrow)}>
              Write it now
            </Link>
          }
        >
          Tomorrow’s Capsule ({shortDayLabel(tomorrow)}) isn’t written yet. It goes live at midnight
          (WAT).
        </Banner>
      )}

      <div className="kc-dash__panels">
        <Panel title="Coming up">
          {days.map(({ day, capsule }) => (
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
      </div>

      <Panel title="Recent activity" empty="Nothing yet.">
        {data.activity.map((a, i) => (
          <PanelRow
            key={`${a.at}-${i}`}
            lead={activityWhen(a.at, now)}
            trail={a.badge && <Badge variant="scheduled">{a.badge}</Badge>}
          >
            {a.href ? <Link to={a.href}>{a.text}</Link> : a.text}
          </PanelRow>
        ))}
      </Panel>
    </>
  );
}
