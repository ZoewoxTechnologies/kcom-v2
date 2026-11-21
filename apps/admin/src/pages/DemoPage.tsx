import { ButtonsDemo } from "../demo/ButtonsDemo";
import { AvatarBadgeTagDemo } from "../demo/AvatarBadgeTagDemo";
import { DataTableDemo } from "../demo/DataTableDemo";
import { DialogDemo } from "../demo/DialogDemo";
import { EditorKitDemo } from "../demo/EditorKitDemo";
import { MenuDemo } from "../demo/MenuDemo";
import { DateTimePickerDemo } from "../demo/DateTimePickerDemo";
import { FormFieldsDemo } from "../demo/FormFieldsDemo";
import { RichTextDemo } from "../demo/RichTextDemo";
import { ToastDemo } from "../demo/ToastDemo";

/** Component demos, public so review screenshots need no sign-in. */
export function DemoPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "var(--font-body)" }}>
      <h1 style={{ fontFamily: "var(--font-title)", color: "var(--color-deep-water)" }}>
        KCOM Admin
      </h1>
      <ButtonsDemo />
      <DataTableDemo />
      <DialogDemo />
      <EditorKitDemo />
      <MenuDemo />
      <FormFieldsDemo />
      <RichTextDemo />
      <AvatarBadgeTagDemo />
      <DateTimePickerDemo />
      <ToastDemo />
    </main>
  );
}
