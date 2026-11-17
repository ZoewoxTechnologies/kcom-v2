import { Avatar, Badge, Tag } from "@kcom/ui";
import type { BadgeVariant } from "@kcom/ui";

const variants: BadgeVariant[] = [
  "draft",
  "scheduled",
  "published",
  "confirmed",
  "pending",
  "unsubscribed",
];

const row = { display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" } as const;
const stack = { display: "flex", flexDirection: "column", gap: "1.5rem" } as const;

export function AvatarBadgeTagDemo() {
  return (
    <section style={stack}>
      <h2 style={{ margin: 0 }}>Avatar, badge, tag</h2>
      <div style={{ ...row, padding: "0.25rem" }}>
        <Avatar name="Ada Lovelace" size="sm" />
        <Avatar name="Ada Lovelace" />
        <Avatar name="Ada Lovelace" size="lg" />
        <Avatar name="Ada Lovelace" size="xl" />
        <Avatar name="Broken Image" src="/missing.jpg" size="lg" />
      </div>
      <div style={row}>
        {variants.map((v) => (
          <Badge key={v} variant={v}>
            {v[0]!.toUpperCase() + v.slice(1)}
          </Badge>
        ))}
      </div>
      <div style={row}>
        <Tag>New Year Message</Tag>
        <Tag href="#">Prophetic</Tag>
      </div>
    </section>
  );
}
