import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kcom/ui";

export function DropdownMenuDemo() {
  return (
    <section>
      <h2>Dropdown menu</h2>
      <div style={{ display: "flex", gap: "3rem", alignItems: "flex-start", minHeight: "16rem" }}>
        <DropdownMenu defaultOpen modal={false}>
          <DropdownMenuTrigger>Row actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Event</DropdownMenuLabel>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem disabled>Archive</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <details className="kc-menu-wrap" style={{ marginInlineStart: "10rem" }} open>
          <summary className="kc-menu-trigger">Capstone Capsules (no JS)</summary>
          <div className="kc-menu">
            <a className="kc-menu__item" href="#today">Today’s Capsule</a>
            <a className="kc-menu__item" href="#month">Browse by month</a>
            <a className="kc-menu__item" href="#series">Browse by series</a>
          </div>
        </details>
      </div>
    </section>
  );
}
