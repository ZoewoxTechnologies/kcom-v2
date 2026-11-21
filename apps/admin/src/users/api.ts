import type { UserRole } from "@kcom/permissions";
import { apiJson } from "../api/client";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  deactivatedAt: string | null;
  createdAt: string;
}

export interface InviteInput {
  email: string;
  name?: string;
  role: UserRole;
}

const call = <T>(path: string, init?: RequestInit) => apiJson<T>(`/users${path}`, init);
const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const listUsers = () => call<UserRecord[]>("");
export const inviteUser = (input: InviteInput) => post<UserRecord>("", input);
export const resendInvite = (id: string) => post<void>(`/${id}/resend-invite`);
export const changeRole = (id: string, role: UserRole) =>
  call<UserRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
export const deactivateUser = (id: string) => post<UserRecord>(`/${id}/deactivate`);
export const reactivateUser = (id: string) => post<UserRecord>(`/${id}/reactivate`);
