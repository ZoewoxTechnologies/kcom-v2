import { useEffect, useId, useRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { initMenu } from "../menu/menu";
import type { ButtonSize, ButtonVariant } from "./Button";

const cx = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" ");

export interface MenuProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Content of the trigger button: text, an icon, anything. */
  trigger: ReactNode;
  /** Render the trigger as the shared button (omit for a plain text trigger). */
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
  /** Accessible name for the trigger when it has no text. */
  triggerLabel?: string;
  /** Which trigger edge the panel lines up with. Use "end" for a trigger at the right of a bar. */
  align?: "start" | "end";
  children: ReactNode;
}

/** Dropdown menu on the native Popover API. Import "@kcom/ui/menu.css" once per app. */
export function Menu({
  trigger,
  triggerVariant,
  triggerSize = "md",
  triggerClassName,
  triggerLabel,
  align = "start",
  className,
  children,
  ...rest
}: MenuProps) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => (ref.current ? initMenu(ref.current) : undefined), []);

  return (
    <div
      {...rest}
      ref={ref}
      className={cx("kc-menu-wrap", className)}
      data-kc-menu
      data-align={align === "end" ? "end" : undefined}
    >
      <button
        type="button"
        className={cx(
          "kc-menu-trigger",
          triggerVariant && `kc-btn kc-btn--${triggerVariant}`,
          triggerVariant && triggerSize !== "md" && `kc-btn--${triggerSize}`,
          triggerClassName,
        )}
        popoverTarget={id}
        aria-haspopup="menu"
        aria-expanded="false"
        aria-label={triggerLabel}
      >
        {trigger}
      </button>
      <div id={id} popover="auto" className="kc-menu" role="menu">
        {children}
      </div>
    </div>
  );
}

export type MenuItemVariant = "default" | "danger";

interface ItemCommon {
  variant?: MenuItemVariant;
}
export type MenuItemProps = ItemCommon &
  (
    | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
    | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
  );

export function MenuItem(props: MenuItemProps) {
  const { variant = "default", className, ...rest } = props;
  const common = {
    role: "menuitem",
    className: cx("kc-menu__item", variant !== "default" && `kc-menu__item--${variant}`, className),
  };
  if (props.href !== undefined) {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} href={props.href} {...common} />
    );
  }
  return (
    <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} {...common} />
  );
}

export function MenuLabel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} role="presentation" className={cx("kc-menu__label", className)} />;
}

export function MenuSeparator({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} role="separator" className={cx("kc-menu__separator", className)} />;
}
