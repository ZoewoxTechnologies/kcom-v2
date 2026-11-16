import { Button } from "@kcom/ui";
import { DropdownMenuDemo } from "./demo/DropdownMenuDemo";

export function App() {
  return (
    <main style={{ padding: "2rem", fontFamily: "var(--font-body)" }}>
      <h1 style={{ fontFamily: "var(--font-title)", color: "var(--color-deep-water)" }}>
        KCOM Admin
      </h1>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
      </div>
      <DropdownMenuDemo />
    </main>
  );
}
