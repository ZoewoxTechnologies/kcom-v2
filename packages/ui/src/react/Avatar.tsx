import { Fallback, Image, Root } from "@radix-ui/react-avatar";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  /** Full name; used for the image alt text and to derive initials. */
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0]!;
  const last = words.length > 1 ? words[words.length - 1]! : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** Image with an initials fallback when there is no src or it fails to load.
    Import "@kcom/ui/avatar.css". */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const classes = ["kc-avatar", size !== "md" && `kc-avatar--${size}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Root className={classes}>
      {src && <Image className="kc-avatar__image" src={src} alt={name} />}
      <Fallback className="kc-avatar__fallback" role="img" aria-label={name} delayMs={0}>
        <span aria-hidden="true">{initialsOf(name)}</span>
      </Fallback>
    </Root>
  );
}
