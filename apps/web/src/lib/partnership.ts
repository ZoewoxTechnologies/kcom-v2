/** Shaped like the future settings API; replace `sampleSettings` with that fetch when it lands. */
export interface PartnershipSettings {
  bank: { bankName: string | null; accountName: string | null; accountNumber: string | null; sortOrSwift: string | null };
}

export const sampleSettings: PartnershipSettings = {
  bank: { bankName: "Sample Bank", accountName: "Kingdom Capstone Outreach Ministries", accountNumber: "0123456789", sortOrSwift: null },
};

export interface Row { label: string; value: string }

const rows = (pairs: [string, string | null][]): Row[] =>
  pairs.flatMap(([label, v]) => (v?.trim() ? [{ label, value: v.trim() }] : []));

/** Bank rows with a value; empty list means the block is hidden. */
export const bankRows = (s: PartnershipSettings): Row[] =>
  rows([["Bank", s.bank.bankName], ["Account name", s.bank.accountName], ["Account number", s.bank.accountNumber], ["Sort / SWIFT code", s.bank.sortOrSwift]]);

export const ways = [
  { n: "One", title: "Prayer Partners", text: "Provide consistent prayer support and take part in KCOM activities and events.", cta: "Pray with us" },
  { n: "Two", title: "Prosperity Partners", text: "Give financial and material support regularly: weekly, monthly, quarterly or yearly.", cta: "Give regularly" },
  { n: "Three", title: "Project Partners", text: "Offer financial, technical or advisory support for special events and projects.", cta: "Support a project" },
] as const;

/** Partner types offered by the join form. */
export const partnerTypes = ways.map((w) => w.title);
