import { Button, type ButtonSize, type ButtonVariant } from "@kcom/ui";

const variants: ButtonVariant[] = ["primary", "secondary", "tertiary", "give"];
const sizes: ButtonSize[] = ["sm", "md", "lg"];

export function ButtonsDemo() {
  return (
    <section aria-labelledby="buttons-demo">
      <h2 id="buttons-demo">Buttons</h2>
      {sizes.map((size) => (
        <div
          key={size}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "center",
            marginBlock: "1rem",
          }}
        >
          <strong style={{ width: "2rem" }}>{size}</strong>
          {variants.map((variant) => (
            <Button key={variant} variant={variant} size={size}>
              {variant}
            </Button>
          ))}
          <Button size={size} loading>
            Saving
          </Button>
          <Button size={size} disabled>
            Disabled
          </Button>
          <Button size={size}>Subscribe to the daily devotional email</Button>
        </div>
      ))}
    </section>
  );
}
