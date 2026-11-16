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
  children: ReactNode;
}

/** Dropdown menu on the native Popover API. Import "@kcom/ui/menu.css" once per app. */
export function Menu({
  trigger,
  triggerVariant,
  triggerSize = "md",
  triggerClassName,
  triggerLabel,
  className,
  children,
  ...rest
}: MenuProps) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => (ref.current ? initMenu(ref.current) : undefined), []);

  return (
    <div {...rest} ref={ref} className={cx("kc-menu-wrap", className)} data-kc-menu>
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

interface ItemCommon {
  danger?: boolean;
}
export type MenuItemProps = ItemCommon &
  (
    | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
    | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
  );

export function MenuItem(props: MenuItemProps) {
  const { danger, className, ...rest } = props;
  const common = {
    role: "menuitem",
    className: cx("kc-menu__item", className),
    "data-danger": danger || undefined,
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
