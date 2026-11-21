import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  DataTable,
  DEFAULT_TIME_ZONE,
  IconButton,
  SegmentedControl,
  SelectField,
  Tooltip,
  CompactList,
  Pagination,
  useToast,
  Banner,
} from "@kcom/ui";
import type { DataTableColumn } from "@kcom/ui";
import { contactTopicLabels, contactTopics, type ContactTopic } from "@kcom/db/contact-topics";
import {
  listMessages,
  PAGE_SIZE,
  setMessageStatus,
  type ContactMessage,
  type MessageStatus,
} from "./api";
import { useIsPhone } from "../shell/useIsPhone";
import { bumpUnread, refreshUnread } from "./unread";

type StatusFilter = "all" | MessageStatus;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
] as const;

export const topicLabel = (t: ContactTopic) => contactTopicLabels[t];

const formatShortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

const formatDate = (iso: string, time = false) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(time && { hour: "2-digit", minute: "2-digit" }),
  }).format(new Date(iso));

/** A mailto: link that replies to the sender with the topic as the subject. */
export const replyHref = (m: Pick<ContactMessage, "email" | "topic">) =>
  `mailto:${m.email}?subject=${encodeURIComponent(`Re: your ${m.topic} message to Kingdom Capstone Outreach Ministries`)}`;

const icon = (path: string) => (
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
    <path d={path} />
  </svg>
);
/** Small lock for messages the sender asked to keep private. Icon only, named by its tooltip. */
function PrivateMark() {
  return (
    <Tooltip label="Private">
      <span className="kc-inbox__lock" role="img" aria-label="Private" tabIndex={0}>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
    </Tooltip>
  );
}

const UNREAD_ICON = "M4 6h16v12H4zM4 7l8 6 8-6";
const READ_ICON = "M4 9l8-5 8 5v10H4zM4 9l8 6 8-6";

/** Admin Inbox: contact messages in a list beside the open message. */
export function InboxPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [topic, setTopic] = useState<ContactTopic | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: ContactMessage[]; total: number } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(
        await listMessages(
          { status: status === "all" ? undefined : status, topic: topic || undefined },
          page,
        ),
      );
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [status, topic, page]);
  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];
  const selected = items.find((m) => m.id === selectedId) ?? null;

  const update = (m: ContactMessage, next: MessageStatus) => {
    const apply = (s: MessageStatus) => (rows: typeof data) =>
      rows && { ...rows, items: rows.items.map((r) => (r.id === m.id ? { ...r, status: s } : r)) };
    setData(apply(next));
    bumpUnread(next === "new" ? 1 : -1);
    setMessageStatus(m.id, next).then(
      () => void refreshUnread(),
      () => {
        setData(apply(m.status));
        void refreshUnread();
        toast({
          variant: "error",
          title: "Couldn’t update the message",
          description: "Try again.",
        });
      },
    );
  };

  const open = (m: ContactMessage) => {
    setSelectedId(m.id);
    if (m.status === "new") update(m, "read");
  };

  const stateBadge = (m: ContactMessage) =>
    m.status === "new" ? (
      <Badge variant="pending">New</Badge>
    ) : (
      <Badge variant="confirmed">Read</Badge>
    );

  const columns: DataTableColumn<ContactMessage>[] = [
    {
      key: "name",
      header: "From",
      render: (m) => (
        <span className={m.status === "new" ? "kc-inbox__unread" : undefined}>{m.name}</span>
      ),
    },
    {
      key: "topic",
      header: "Topic",
      width: "9rem",
      render: (m) => (
        <span className="kc-inbox__topic">
          {topicLabel(m.topic)}
          {m.keepPrivate && <PrivateMark />}
        </span>
      ),
    },
    { key: "date", header: "Date", width: "8rem", accessor: (m) => formatDate(m.createdAt) },
    {
      key: "status",
      header: "State",
      width: "6rem",
      render: stateBadge,
    },
  ];

  const phone = useIsPhone();
  const filtered = status !== "all" || topic !== "";
  return (
    <section className="kc-inbox">
      <header className="kc-inbox__head">
        <h1>Inbox</h1>
      </header>
      <div className="kc-inbox__body">
        <div className="kc-inbox__list">
          <div className="kc-inbox__filters">
            <SegmentedControl
              label="Show"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
            <SelectField
              label="Topic"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value as ContactTopic | "");
                setPage(1);
              }}
            >
              <option value="">All topics</option>
              {contactTopics.map((t) => (
                <option key={t} value={t}>
                  {topicLabel(t)}
                </option>
              ))}
            </SelectField>
          </div>
          {loadFailed ? (
            <Banner
              variant="danger"
              action={
                <Button variant="tertiary" onClick={() => void load()}>
                  Retry
                </Button>
              }
            >
              Couldn&rsquo;t load messages
            </Banner>
          ) : data === null ? (
            <p className="kc-inbox__loading">Loading messages…</p>
          ) : (
            <>
              {phone ? (
                <>
                  <CompactList
                    caption="Contact messages"
                    rows={items}
                    getRowId={(m) => m.id}
                    selectedRowId={selected?.id ?? null}
                    onRowClick={open}
                    isEmphasised={(m) => m.status === "new"}
                    title={(m) => m.name}
                    trailing={stateBadge}
                    subtitle={(m) => (
                      <>
                        {topicLabel(m.topic)}
                        {m.keepPrivate && <PrivateMark />}
                        <span aria-hidden="true">·</span>
                        {formatShortDate(m.createdAt)}
                      </>
                    )}
                    emptyTitle={filtered ? "No messages match" : "No messages yet"}
                    emptyMessage={
                      filtered
                        ? "Try a different filter."
                        : "Messages sent from the contact page appear here."
                    }
                  />
                  {data.total > PAGE_SIZE && (
                    <Pagination
                      page={page}
                      pageCount={Math.ceil(data.total / PAGE_SIZE)}
                      onPageChange={setPage}
                    />
                  )}
                </>
              ) : (
                <DataTable
                  caption="Contact messages"
                  columns={columns}
                  rows={items}
                  getRowId={(m) => m.id}
                  selectedRowId={selected?.id ?? null}
                  onRowClick={open}
                  pagination={{
                    page,
                    pageSize: PAGE_SIZE,
                    total: data.total,
                    onPageChange: setPage,
                  }}
                  emptyTitle={filtered ? "No messages match" : "No messages yet"}
                  emptyMessage={
                    filtered
                      ? "Try a different filter."
                      : "Messages sent from the contact page appear here."
                  }
                />
              )}
            </>
          )}
        </div>
        <div className="kc-inbox__side">
          {selected ? (
            <article className="kc-inbox__message" aria-label={`Message from ${selected.name}`}>
              <header>
                <div>
                  <h2>{selected.name}</h2>
                  <p className="kc-inbox__meta">
                    {topicLabel(selected.topic)} · {formatDate(selected.createdAt, true)}
                    {selected.keepPrivate && <PrivateMark />}
                  </p>
                </div>
                <IconButton
                  label={selected.status === "new" ? "Mark as read" : "Mark as unread"}
                  icon={icon(selected.status === "new" ? READ_ICON : UNREAD_ICON)}
                  onClick={() => update(selected, selected.status === "new" ? "read" : "new")}
                />
              </header>
              <p className="kc-inbox__text">{selected.message}</p>
              <footer>
                <ButtonLink href={replyHref(selected)}>Reply to {selected.email}</ButtonLink>
              </footer>
            </article>
          ) : (
            <aside className="kc-inbox__empty">
              <h2>No message open</h2>
              <p>Pick a message on the left to read it.</p>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
