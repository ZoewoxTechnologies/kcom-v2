import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Badge } from "@kcom/ui";
import { kindLabel, resultPath, searchContent, type SearchResult } from "./api";
import { useDebouncedValue } from "./useDebouncedValue";

export const SEARCH_DELAY_MS = 300;

const statusLabel = { draft: "Draft", scheduled: "Scheduled", published: "Published" } as const;

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; items: SearchResult[] }
  | { phase: "error" };

/** Top-bar search over capsules, blog posts and events. Requests wait for a pause in typing. */
export function AdminSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<State>({ phase: "idle" });
  const query = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);

  useEffect(() => {
    if (!query) {
      setState({ phase: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ phase: "loading" });
    searchContent(query, controller.signal).then(
      (items) => {
        setState({ phase: "done", items });
        setActive(0);
      },
      () => {
        if (!controller.signal.aborted) setState({ phase: "error" });
      },
    );
    return () => controller.abort();
  }, [query]);

  // A click anywhere else closes the results.
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);

  const items = state.phase === "done" ? state.items : [];
  const show = open && text.trim() !== "";
  const choose = (item: SearchResult) => {
    setOpen(false);
    setText("");
    navigate(resultPath(item));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && show && items[active]) {
      e.preventDefault();
      choose(items[active]);
    }
  };

  const message =
    state.phase === "error"
      ? "Search failed. Try again."
      : state.phase === "done" && items.length === 0
        ? "No matches."
        : state.phase === "loading" || text.trim() !== query
          ? "Searching…"
          : null;

  return (
    <div className="kc-search" ref={root}>
      <input
        type="search"
        className="kc-search__input"
        placeholder="Search content"
        aria-label="Search capsules, blog and events"
        role="combobox"
        aria-expanded={show && items.length > 0}
        aria-controls={listId}
        aria-activedescendant={show && items[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <AnimatePresence>
        {show && (
          <motion.div
            className="kc-search__panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {message && (
              <p className="kc-search__note" role="status">
                {message}
              </p>
            )}
            {items.length > 0 && (
              <ul
                id={listId}
                role="listbox"
                aria-label="Search results"
                className="kc-search__list"
              >
                {items.map((item, i) => (
                  <li
                    key={`${item.kind}-${item.id}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="kc-search__item"
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(item)}
                  >
                    <span className="kc-search__kind">{kindLabel[item.kind]}</span>
                    <span className="kc-search__title">{item.title}</span>
                    <Badge variant={item.status}>{statusLabel[item.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
