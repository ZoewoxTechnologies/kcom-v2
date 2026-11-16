import { Button } from "@kcom/ui";
import type { ButtonSize, ButtonVariant } from "@kcom/ui";

const variants: ButtonVariant[] = ["primary", "secondary", "tertiary", "give"];
const sizes: ButtonSize[] = ["sm", "md", "lg"];
const row = { display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" } as const;

/** Every button variant at every size, plus loading and disabled, for visual review. */
export function ButtonsDemo() {
  return (
    <section aria-label="Buttons demo" style={{ display: "grid", gap: "1rem" }}>
      {variants.map((variant) => (
        <div key={variant} style={row}>
          {sizes.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {variant} {size}
            </Button>
          ))}
          <Button variant={variant} loading>
            Saving
          </Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
        </div>
      ))}
    </section>
  );
}
