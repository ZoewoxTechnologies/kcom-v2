import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogActions,
  DialogClose,
  IconButton,
  SelectField,
  TextField,
  useToast,
} from "@kcom/ui";
import type { DataTableColumn, DataTableSort } from "@kcom/ui";
import { userRoles, type UserRole } from "@kcom/permissions";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import {
  changeRole,
  deactivateUser,
  inviteUser,
  listUsers,
  reactivateUser,
  resendInvite,
  type UserRecord,
} from "./api";

const PAGE_SIZE = 10;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SELF_HINT = "You can’t change your own role.";
const LAST_ADMIN_HINT = "The only active admin can’t be demoted or deactivated.";

const icon = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
);
const MAIL = "M4 6h16v12H4z M4 7l8 6 8-6";
const BLOCK = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M5.6 5.6l12.8 12.8";
const RESTORE = "M3 12a9 9 0 1 0 3-6.7 M3 4v5h5";

const isActive = (u: UserRecord) => !u.deactivatedAt;

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (user: UserRecord) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setRole("editor");
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await inviteUser({ email, name: name.trim() || undefined, role });
      onInvited(user);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "email_taken"
          ? "A user with this email already exists."
          : err instanceof ApiError && err.status === 400
            ? "Enter a valid email address."
            : "Could not send the invite. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite a user"
      description="They get an email with a link to set a password."
    >
      <form className="kc-users__form" onSubmit={(e) => void submit(e)}>
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <TextField label="Name" optional value={name} onChange={(e) => setName(e.target.value)} />
        <SelectField
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {userRoles.map((r) => (
            <option key={r} value={r}>
              {cap(r)}
            </option>
          ))}
        </SelectField>
        <DialogActions>
          <Button type="submit" loading={busy}>
            Send invite
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Admin-only list of users: invite, change role, deactivate and reactivate. */
export function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSort | null>({ key: "name", direction: "ascending" });
  const [inviting, setInviting] = useState(false);
  const [confirming, setConfirming] = useState<UserRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const replace = (next: UserRecord) =>
    setUsers((list) => (list ?? []).map((u) => (u.id === next.id ? { ...u, ...next } : u)));
  const activeAdmins = (users ?? []).filter((u) => u.role === "admin" && isActive(u)).length;
  const isLastAdmin = (u: UserRecord) => u.role === "admin" && isActive(u) && activeAdmins <= 1;

  /** Runs an action; the API's last-admin refusal is explained, other failures are generic. */
  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
    } catch (err) {
      const lastAdmin = err instanceof ApiError && err.code === "last_admin";
      toast({
        variant: "error",
        title: lastAdmin ? "Keep at least one admin" : failure,
        description: lastAdmin ? LAST_ADMIN_HINT : "Try again.",
      });
      if (lastAdmin) void load();
    }
  };

  const onRole = (u: UserRecord, role: UserRole) =>
    run(async () => {
      replace(await changeRole(u.id, role));
      toast({
        variant: "success",
        title: `${u.name} is now ${role === "admin" ? "an admin" : "an editor"}`,
      });
    }, "Couldn’t change the role");

  const onResend = (u: UserRecord) =>
    run(async () => {
      await resendInvite(u.id);
      toast({ variant: "success", title: `Invite sent to ${u.email}` });
    }, "Couldn’t send the invite");

  const onReactivate = (u: UserRecord) =>
    run(async () => {
      replace(await reactivateUser(u.id));
      toast({ variant: "success", title: `${u.name} reactivated` });
    }, "Couldn’t reactivate the user");

  const onDeactivate = async () => {
    const target = confirming;
    if (!target) return;
    setBusy(true);
    await run(async () => {
      replace(await deactivateUser(target.id));
      toast({ variant: "success", title: `${target.name} deactivated` });
    }, "Couldn’t deactivate the user");
    setBusy(false);
    setConfirming(null);
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const key = (sort?.key ?? "name") as "name" | "role" | "status";
    const factor = sort?.direction === "descending" ? -1 : 1;
    const value = (u: UserRecord) => (key === "status" ? (isActive(u) ? "0" : "1") : u[key]);
    return (users ?? [])
      .filter(
        (u) =>
          !needle ||
          u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle),
      )
      .sort((a, b) => value(a).localeCompare(value(b)) * factor);
  }, [users, q, sort]);

  const columns: DataTableColumn<UserRecord>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (u) => (
        <span className="kc-users__person">
          <Avatar name={u.name} size="sm" />
          <span className="kc-users__who">
            <span className="kc-users__name">{u.name}</span>
            <span className="kc-users__email">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      width: "10rem",
      render: (u) => (
        <SelectField
          size="sm"
          label={`Role for ${u.name}`}
          className="kc-users__role"
          value={u.role}
          disabled={!isActive(u) || isLastAdmin(u) || u.id === me?.id}
          title={isLastAdmin(u) ? LAST_ADMIN_HINT : u.id === me?.id ? SELF_HINT : undefined}
          onChange={(e) => void onRole(u, e.target.value as UserRole)}
        >
          {userRoles.map((r) => (
            <option key={r} value={r}>
              {cap(r)}
            </option>
          ))}
        </SelectField>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "9rem",
      render: (u) =>
        isActive(u) ? (
          <Badge variant="published">Active</Badge>
        ) : (
          <Badge variant="unsubscribed">Deactivated</Badge>
        ),
    },
  ];

  return (
    <section className="kc-users">
      <header className="kc-users__head">
        <h1>Users</h1>
        <Button onClick={() => setInviting(true)}>Invite user</Button>
      </header>
      {activeAdmins === 1 && (
        <Banner variant="info">
          There must always be an active admin, so the only admin can’t be demoted or deactivated.
          Make someone else an admin first.
        </Banner>
      )}
      <form className="kc-users__filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <TextField
          size="sm"
          label="Search"
          type="search"
          placeholder="Name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </form>
      {failed ? (
        <Banner
          variant="danger"
          action={
            <Button variant="tertiary" onClick={() => void load()}>
              Try again
            </Button>
          }
        >
          Could not load users.
        </Banner>
      ) : users === null ? (
        <p className="kc-admin-loading">Loading users…</p>
      ) : (
        <DataTable
          caption="Users"
          columns={columns}
          rows={rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          getRowId={(u) => u.id}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          emptyTitle={users.length === 0 ? "No users yet" : "No users match"}
          emptyMessage={
            users.length === 0 ? "Invite someone to see them here." : "Try a different search."
          }
          rowActionHeader="Actions"
          rowAction={(u) => (
            <span className="kc-users__actions">
              {isActive(u) ? (
                <>
                  {u.invitePending && (
                    <IconButton
                      label={`Resend invite to ${u.email}`}
                      icon={icon(MAIL)}
                      onClick={() => void onResend(u)}
                    />
                  )}
                  <IconButton
                    label={isLastAdmin(u) ? LAST_ADMIN_HINT : `Deactivate ${u.name}`}
                    icon={icon(BLOCK)}
                    disabled={isLastAdmin(u) || u.id === me?.id}
                    onClick={() => setConfirming(u)}
                  />
                </>
              ) : (
                <IconButton
                  label={`Reactivate ${u.name}`}
                  icon={icon(RESTORE)}
                  onClick={() => void onReactivate(u)}
                />
              )}
            </span>
          )}
        />
      )}
      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        onInvited={(u) => {
          setUsers((list) => [...(list ?? []), u]);
          toast({ variant: "success", title: `Invite sent to ${u.email}` });
        }}
      />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(o) => !o && !busy && setConfirming(null)}
        variant="danger"
        title={`Deactivate ${confirming?.name ?? ""}?`}
        message="They are signed out now and can’t sign in until you reactivate them."
        confirmLabel="Deactivate"
        busy={busy}
        onConfirm={() => void onDeactivate()}
      />
    </section>
  );
}
