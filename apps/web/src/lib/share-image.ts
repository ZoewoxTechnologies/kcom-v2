import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import serifUrl from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff?inline";
import sansUrl from "@fontsource/nunito-sans/files/nunito-sans-latin-600-normal.woff?inline";
import { siteName } from "./site";

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

export interface ShareCard {
  title: string;
  /** Small gold line above the title, e.g. the scripture reference. */
  kicker?: string | null;
  /** Small line under the title, e.g. the date or series. */
  footer?: string | null;
}

const decode = (dataUri: string): ArrayBuffer => {
  const b = Buffer.from(dataUri.slice(dataUri.indexOf(",") + 1), "base64");
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style: { display: "flex", ...style }, children } });

/** Title font size that keeps long titles inside the card. */
export const titleSize = (title: string): number => (title.length > 70 ? 54 : title.length > 40 ? 68 : 84);

export function shareTree(card: ShareCard): Node {
  return el("div", { width: SHARE_WIDTH, height: SHARE_HEIGHT, flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#1a3e4d", color: "#ffffff", borderTop: "14px solid #c4a15a", boxSizing: "border-box" }, [
    el("div", { flexDirection: "column" }, [
      card.kicker ? el("div", { fontFamily: "Nunito Sans", fontSize: 30, color: "#c4a15a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 24 }, card.kicker) : el("div", { height: 0 }),
      el("div", { fontFamily: "Cormorant Garamond", fontSize: titleSize(card.title), lineHeight: 1.1 }, card.title),
    ]),
    el("div", { flexDirection: "column" }, [
      card.footer ? el("div", { fontFamily: "Nunito Sans", fontSize: 28, color: "#cfe3ec", marginBottom: 18 }, card.footer) : el("div", { height: 0 }),
      el("div", { height: 3, width: 96, background: "#c4a15a", marginBottom: 18 }),
      el("div", { fontFamily: "Nunito Sans", fontSize: 26, color: "#ffffff" }, siteName),
    ]),
  ]);
}

/** A 1200×630 PNG for Open Graph and Twitter cards. */
export async function renderShareImage(card: ShareCard): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(shareTree(card) as never, {
    width: SHARE_WIDTH,
    height: SHARE_HEIGHT,
    fonts: [
      { name: "Cormorant Garamond", data: decode(serifUrl), weight: 600, style: "normal" },
      { name: "Nunito Sans", data: decode(sansUrl), weight: 600, style: "normal" },
    ],
  });
  return new Uint8Array(new Resvg(svg).render().asPng());
}
