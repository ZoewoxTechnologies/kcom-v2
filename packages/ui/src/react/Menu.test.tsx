// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "./Menu";
import { initMenu } from "../menu/menu";

const markup = () =>
  renderToStaticMarkup(
    <Menu trigger="Actions">
      <MenuLabel>Event</MenuLabel>
      <MenuItem>Edit</MenuItem>
      <MenuItem href="/x">Open</MenuItem>
      <MenuItem disabled>Archive</MenuItem>
      <MenuSeparator />
      <MenuItem danger>Delete</MenuItem>
    </Menu>,
  );

describe("Menu markup", () => {
  it("renders the popover trigger and panel with ARIA roles", () => {
    const html = markup();
    expect(html).toContain("data-kc-menu");
    expect(html).toContain('class="kc-menu-trigger"');
    expect(html.toLowerCase()).toContain("popovertarget");
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("popover=");
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="separator"');
    expect(html).toContain('role="menuitem"');
  });

  it("renders links for href items and a danger flag", () => {
    const html = markup();
    expect(html).toContain('<a href="/x"');
    expect(html).toContain('data-danger="true"');
  });
});

describe("initMenu keyboard behaviour", () => {
  let wrap: HTMLElement;
  let trigger: HTMLElement;
  let panel: HTMLElement;
  let open = false;

  beforeEach(() => {
    open = false;
    document.body.innerHTML = markup();
    wrap = document.querySelector("[data-kc-menu]")!;
    trigger = wrap.querySelector("button")!;
    panel = wrap.querySelector("[popover]")!;
    // jsdom has no Popover API: stub it.
    panel.showPopover = () => {
      open = true;
      panel.dispatchEvent(Object.assign(new Event("toggle"), { newState: "open" }));
    };
    panel.hidePopover = () => {
      open = false;
      panel.dispatchEvent(Object.assign(new Event("toggle"), { newState: "closed" }));
    };
    const matches = panel.matches.bind(panel);
    panel.matches = (sel: string) => (sel === ":popover-open" ? open : matches(sel));
    initMenu(wrap);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const key = (el: Element, k: string) =>
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const labels = () => Array.from(panel.querySelectorAll<HTMLElement>(".kc-menu__item"));

  it("ArrowDown on the trigger opens and focuses the first item; ArrowUp the last", () => {
    key(trigger, "ArrowDown");
    expect(document.activeElement).toBe(labels()[0]);
    panel.hidePopover();
    key(trigger, "ArrowUp");
    expect(document.activeElement?.textContent).toBe("Delete");
  });

  it("arrows wrap, skip disabled items, Home and End jump", () => {
    key(trigger, "ArrowDown");
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Open");
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Delete");
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Edit");
    key(document.activeElement!, "End");
    expect(document.activeElement?.textContent).toBe("Delete");
    key(document.activeElement!, "Home");
    expect(document.activeElement?.textContent).toBe("Edit");
  });

  it("typeahead focuses the matching item", () => {
    key(trigger, "ArrowDown");
    key(document.activeElement!, "d");
    expect(document.activeElement?.textContent).toBe("Delete");
  });

  it("syncs aria-expanded and closes on item click and Tab", () => {
    key(trigger, "ArrowDown");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    labels()[0]!.click();
    expect(open).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    key(trigger, "ArrowDown");
    key(document.activeElement!, "Tab");
    expect(open).toBe(false);
  });
});
