import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";

const cx = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");

export const DropdownMenu = RadixMenu.Root;

export function DropdownMenuTrigger({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Trigger>) {
  return <RadixMenu.Trigger {...rest} className={cx("kc-menu-trigger", className)} />;
}

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "start",
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        {...rest}
        sideOffset={sideOffset}
        align={align}
        className={cx("kc-menu", className)}
      />
    </RadixMenu.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof RadixMenu.Item> {
  danger?: boolean;
}

export function DropdownMenuItem({ className, danger, ...rest }: DropdownMenuItemProps) {
  return (
    <RadixMenu.Item
      {...rest}
      data-danger={danger || undefined}
      className={cx("kc-menu__item", className)}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Label>) {
  return <RadixMenu.Label {...rest} className={cx("kc-menu__label", className)} />;
}

export function DropdownMenuSeparator({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Separator>) {
  return <RadixMenu.Separator {...rest} className={cx("kc-menu__separator", className)} />;
}
