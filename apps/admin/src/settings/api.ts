import { apiJson } from "../api/client";

export interface SettingsGroups {
  contact: { email: string | null; phone: string | null; address: string | null };
  social: {
    facebook: string | null;
    youtube: string | null;
    instagram: string | null;
    x: string | null;
    whatsappChannel: string | null;
    telegram: string | null;
  };
  bank: {
    bankName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    sortOrSwift: string | null;
  };
}

export type GroupName = keyof SettingsGroups;

export interface ListItem {
  id: string;
  name: string;
  /** Team: role. Arms: description. Shown under the name. */
  [key: string]: string | null;
}

export interface AllSettings extends SettingsGroups {
  team: ListItem[];
  arms: ListItem[];
}

export type ListName = "team" | "arms";

const call = <T>(path: string, init?: RequestInit) => apiJson<T>(`/admin/settings${path}`, init);
const body = (value: unknown) => JSON.stringify(value);

export const fetchSettings = () => call<AllSettings>("");

/** Saves one group; blank strings clear a field. */
export const saveGroup = <G extends GroupName>(group: G, values: Record<string, string>) =>
  call<AllSettings>("", { method: "PATCH", body: body({ [group]: values }) });

export const createItem = (list: ListName, values: Record<string, string>) =>
  call<ListItem>(`/${list}`, { method: "POST", body: body(values) });

export const updateItem = (list: ListName, id: string, values: Record<string, string>) =>
  call<ListItem>(`/${list}/${id}`, { method: "PATCH", body: body(values) });

export const deleteItem = (list: ListName, id: string) =>
  call<void>(`/${list}/${id}`, { method: "DELETE" });

export const reorderItems = (list: ListName, ids: string[]) =>
  call<{ items: ListItem[] }>(`/${list}/order`, { method: "PUT", body: body({ ids }) }).then(
    (r) => r.items,
  );
