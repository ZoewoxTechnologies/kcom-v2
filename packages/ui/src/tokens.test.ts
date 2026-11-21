import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/tokens.css"), "utf8");

/** Token values from the block that starts at `marker`. */
function block(marker: string): Record<string, string> {
  const start = css.indexOf(marker);
  const end = css.indexOf("\n  }", start);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/(--color-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!;
  return out;
}

const light = block(":root,\n  [data-theme=\"light\"]");
const dark = { ...light, ...block(":root[data-theme=\"dark\"],") };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const pairs: [fg: string, bg: string][] = [
  ["--color-text", "--color-page"],
  ["--color-text", "--color-surface"],
  ["--color-muted", "--color-page"],
  ["--color-muted", "--color-wash"],
  ["--color-muted", "--color-surface"],
  ["--color-primary", "--color-page"],
  ["--color-primary", "--color-wash"],
  ["--color-gold-text", "--color-page"],
  ["--color-gold-text", "--color-wash"],
  ["--color-gold-text", "--color-sandstone"],
  ["--color-on-primary", "--color-primary"],
  ["--color-error", "--color-surface"],
  ["--color-on-footer", "--color-footer"],
  ["--color-footer-gold", "--color-footer"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme text contrast", (_name, tokens) => {
  it.each(pairs)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});
