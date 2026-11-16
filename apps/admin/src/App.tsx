import { ToastProvider } from "@kcom/ui";
import { ButtonsDemo } from "./demo/ButtonsDemo";
import { DataTableDemo } from "./demo/DataTableDemo";
import { DialogDemo } from "./demo/DialogDemo";
import { FormFieldsDemo } from "./demo/FormFieldsDemo";
import { ToastDemo } from "./demo/ToastDemo";

export function App() {
  return (
    <ToastProvider>
      <main style={{ padding: "2rem", fontFamily: "var(--font-body)" }}>
        <h1 style={{ fontFamily: "var(--font-title)", color: "var(--color-deep-water)" }}>
          KCOM Admin
        </h1>
        <ButtonsDemo />
        <DataTableDemo />
        <DialogDemo />
        <FormFieldsDemo />
        <ToastDemo />
      </main>
    </ToastProvider>
  );
}
