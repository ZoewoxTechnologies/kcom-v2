import { Banner, Button } from "@kcom/ui";
import type { BannerVariant } from "@kcom/ui";

const VARIANTS: [BannerVariant, string][] = [
  ["warning", "Tomorrow’s Capsule isn’t written yet. It goes live at midnight (WAT)."],
  ["info", "Messages are kept for 90 days, then archived."],
  ["success", "Your changes were saved."],
  ["danger", "The dashboard could not be loaded."],
];

/** Every banner variant, once under each theme. Banners use tertiary (link-style) actions only. */
export function BannerDemo() {
  return (
    <section>
      <h2>Banners</h2>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))",
        }}
      >
        {(["light", "dark"] as const).map((theme) => (
          <div
            key={theme}
            data-theme={theme}
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "1rem",
              background: "var(--color-page)",
              color: "var(--color-text)",
              colorScheme: theme,
              borderRadius: "var(--radius)",
            }}
          >
            <strong>{theme === "light" ? "Light" : "Dark"}</strong>
            {VARIANTS.map(([variant, text]) => (
              <Banner
                key={variant}
                variant={variant}
                action={
                  <Button variant="tertiary">
                    {variant === "danger" ? "Try again" : "Action"}
                  </Button>
                }
              >
                {text}
              </Banner>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
