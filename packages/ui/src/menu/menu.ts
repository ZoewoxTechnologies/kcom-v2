/* Menu behaviour for the native Popover API.

   Markup (rendered identically by the React and Astro wrappers):
     <div class="kc-menu-wrap" data-kc-menu>
       <button class="kc-menu-trigger" popovertarget="ID" aria-haspopup="menu" aria-expanded="false">…</button>
       <div id="ID" popover class="kc-menu" role="menu">
         <a class="kc-menu__item" role="menuitem" href="…">…</a>
         <div class="kc-menu__separator" role="separator"></div>
       </div>
     </div>

   Without this script the browser still opens and closes the menu, handles Escape and
   outside clicks, and returns focus to the trigger. The script adds arrow-key, Home/End
   and typeahead navigation, closes the menu on item activation, keeps aria-expanded in
   sync and positions the popover under its trigger (data-align="end" lines up right edges). */

const ITEM = ".kc-menu__item";
const READY = "kcMenuReady";

function items(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(ITEM)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true",
  );
}

function place(trigger: HTMLElement, panel: HTMLElement, align: string | undefined) {
  const r = trigger.getBoundingClientRect();
  panel.style.position = "fixed";
  panel.style.margin = "0";
  panel.style.insetBlockStart = `${r.bottom + 8}px`;
  if (align === "end") {
    // Right edges line up: the panel grows leftwards from the trigger.
    panel.style.insetInlineStart = "auto";
    panel.style.insetInlineEnd = `${document.documentElement.clientWidth - r.right}px`;
  } else {
    panel.style.insetInlineEnd = "auto";
    panel.style.insetInlineStart = `${r.left}px`;
  }
}

/** Wire up one menu wrapper. Returns a cleanup function. */
export function initMenu(wrap: HTMLElement): () => void {
  if (wrap.dataset[READY]) return () => {};
  const trigger = wrap.querySelector<HTMLElement>("[popovertarget]");
  const panel = wrap.querySelector<HTMLElement>("[popover]");
  if (!trigger || !panel || typeof panel.showPopover !== "function") return () => {};
  wrap.dataset[READY] = "true";

  const focusAt = (list: HTMLElement[], index: number) => {
    if (list.length === 0) return;
    list[(index + list.length) % list.length]!.focus();
  };

  const onToggle = (event: Event) => {
    const open = (event as ToggleEvent).newState === "open";
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      place(trigger, panel, wrap.dataset.align);
      for (const item of items(panel)) item.tabIndex = -1;
      focusAt(items(panel), 0);
    }
  };

  const onTriggerKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!panel.matches(":popover-open")) panel.showPopover();
    const list = items(panel);
    focusAt(list, event.key === "ArrowUp" ? list.length - 1 : 0);
  };

  let typed = "";
  let typedTimer: ReturnType<typeof setTimeout> | undefined;

  const onPanelKey = (event: KeyboardEvent) => {
    const list = items(panel);
    const current = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(list, current + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusAt(list, current < 0 ? -1 : current - 1);
        return;
      case "Home":
        event.preventDefault();
        focusAt(list, 0);
        return;
      case "End":
        event.preventDefault();
        focusAt(list, -1);
        return;
      case "Tab":
        panel.hidePopover();
        return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typed += event.key.toLowerCase();
      clearTimeout(typedTimer);
      typedTimer = setTimeout(() => (typed = ""), 600);
      const rotated = [...list.slice(current + 1), ...list.slice(0, current + 1)];
      rotated.find((el) => el.textContent?.trim().toLowerCase().startsWith(typed))?.focus();
    }
  };

  const onPanelClick = (event: Event) => {
    if ((event.target as HTMLElement).closest(ITEM) && panel.matches(":popover-open")) {
      panel.hidePopover();
    }
  };

  panel.addEventListener("toggle", onToggle);
  panel.addEventListener("keydown", onPanelKey);
  panel.addEventListener("click", onPanelClick);
  trigger.addEventListener("keydown", onTriggerKey);

  return () => {
    panel.removeEventListener("toggle", onToggle);
    panel.removeEventListener("keydown", onPanelKey);
    panel.removeEventListener("click", onPanelClick);
    trigger.removeEventListener("keydown", onTriggerKey);
    clearTimeout(typedTimer);
    delete wrap.dataset[READY];
  };
}

/** Wire up every menu under `root` (default: the document). */
export function initMenus(root: ParentNode = document): void {
  for (const wrap of root.querySelectorAll<HTMLElement>("[data-kc-menu]")) initMenu(wrap);
}
