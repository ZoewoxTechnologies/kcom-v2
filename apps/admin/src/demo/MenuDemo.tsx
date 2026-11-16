import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@kcom/ui";

export function MenuDemo() {
  return (
    <section>
      <h2>Dropdown menu</h2>
      <div style={{ display: "flex", gap: "3rem", alignItems: "flex-start", minHeight: "16rem" }}>
        <Menu trigger="Row actions">
          <MenuLabel>Event</MenuLabel>
          <MenuItem>Edit</MenuItem>
          <MenuItem>Duplicate</MenuItem>
          <MenuItem disabled>Archive</MenuItem>
          <MenuSeparator />
          <MenuItem danger>Delete</MenuItem>
        </Menu>

        <Menu trigger="Capstone Capsules">
          <MenuItem href="#today">Today’s Capsule</MenuItem>
          <MenuItem href="#month">Browse by month</MenuItem>
          <MenuItem href="#series">Browse by series</MenuItem>
        </Menu>
      </div>
    </section>
  );
}
