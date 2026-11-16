import { ButtonsDemo } from "./demo/ButtonsDemo";
import { FormFieldsDemo } from "./demo/FormFieldsDemo";

export function App() {
  return (
    <main style={{ padding: "2rem", fontFamily: "var(--font-body)" }}>
      <h1 style={{ fontFamily: "var(--font-title)", color: "var(--color-deep-water)" }}>
        KCOM Admin
      </h1>
      <ButtonsDemo />
      <FormFieldsDemo />
    </main>
  );
}
