/** Shaped like the future settings API; replace `sampleSettings` with that fetch when it lands. */
export interface PartnershipSettings {
  bank: { bankName: string | null; accountName: string | null; accountNumber: string | null; sortOrSwift: string | null };
  contact: { email: string | null; phone: string | null; address: string | null };
}

export const sampleSettings: PartnershipSettings = {
  bank: { bankName: "Sample Bank", accountName: "Kingdom Capstone Outreach Ministries", accountNumber: "0123456789", sortOrSwift: null },
  contact: { email: "partner@example.org", phone: "+234 800 000 0000", address: null },
};

export interface Row { label: string; value: string }

const rows = (pairs: [string, string | null][]): Row[] =>
  pairs.flatMap(([label, v]) => (v?.trim() ? [{ label, value: v.trim() }] : []));

/** Bank rows with a value; empty list means the block is hidden. */
export const bankRows = (s: PartnershipSettings): Row[] =>
  rows([["Bank", s.bank.bankName], ["Account name", s.bank.accountName], ["Account number", s.bank.accountNumber], ["Sort / SWIFT code", s.bank.sortOrSwift]]);

export const contactRows = (s: PartnershipSettings): Row[] =>
  rows([["Email", s.contact.email], ["Phone", s.contact.phone], ["Address", s.contact.address]]);

export const ways = [
  { n: "One", title: "Prayer Partners", text: "Provide consistent prayer support and take part in KCOM activities and events." },
  { n: "Two", title: "Prosperity Partners", text: "Give financial and material support regularly: weekly, monthly, quarterly or yearly." },
  { n: "Three", title: "Project Partners", text: "Offer financial, technical or advisory support for special events and projects." },
] as const;
