import { ToastProvider } from "@kcom/ui";
import { ButtonsDemo } from "./demo/ButtonsDemo";
import { AvatarBadgeTagDemo } from "./demo/AvatarBadgeTagDemo";
import { DataTableDemo } from "./demo/DataTableDemo";
import { DialogDemo } from "./demo/DialogDemo";
import { MenuDemo } from "./demo/MenuDemo";
import { DateTimePickerDemo } from "./demo/DateTimePickerDemo";
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
        <MenuDemo />
        <FormFieldsDemo />
        <AvatarBadgeTagDemo />
        <DateTimePickerDemo />
        <ToastDemo />
      </main>
    </ToastProvider>
  );
}
