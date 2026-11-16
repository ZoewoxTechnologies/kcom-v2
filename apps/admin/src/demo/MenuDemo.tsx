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
          <MenuItem variant="danger">Delete</MenuItem>
        </Menu>

        <Menu trigger="Capstone Capsules">
          <MenuItem href="#today">Today’s Capsule</MenuItem>
          <MenuItem href="#month">Browse by month</MenuItem>
          <MenuItem href="#series">Browse by series</MenuItem>
        </Menu>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBlockEnd: "12rem" }}>
        {(["sm", "md", "lg"] as const).map((size) => (
          <Menu
            key={size}
            trigger={`Actions (${size})`}
            triggerVariant="secondary"
            triggerSize={size}
          >
            <MenuItem>Edit</MenuItem>
            <MenuItem>Duplicate</MenuItem>
          </Menu>
        ))}
      </div>
    </section>
  );
}
