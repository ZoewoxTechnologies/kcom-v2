import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Avatar,
  Button,
  CountBadge,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Tag,
} from "@kcom/ui";
import { useAuth } from "../auth/AuthProvider";
import { can } from "@kcom/permissions";
import { useIsPhone } from "./useIsPhone";
import { useUnreadCount } from "../inbox/unread";
import { navFor, navItemFor } from "./nav";

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** Side menu, top bar and content outlet for every signed-in page. */
export function Shell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(!!user && can(user.role, "inbox:read"), pathname);

  const burgerRef = useRef<HTMLButtonElement>(null);
  const phone = useIsPhone();
  // Read at render so it follows the build's env.
  const siteUrl = import.meta.env.VITE_SITE_URL || undefined;
  const focusBurger = () => burgerRef.current?.focus();
  const sideRef = useRef<HTMLElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  const closeDrawer = () => {
    setOpen(false);
    focusBurger();
  };

  // While the drawer is open: focus moves into it, and Escape closes it.
  useEffect(() => {
    if (!open) return;
    sideRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      focusBurger();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user) return null;
  const title = navItemFor(pathname)?.label ?? (pathname === "/profile" ? "Profile" : "");

  return (
    <div className="kc-admin" data-nav-open={open || undefined}>
      <aside
        ref={sideRef}
        className="kc-admin__side"
        id="admin-nav"
        aria-label="Main"
        inert={phone && !open}
      >
        <div className="kc-admin__brand">
          <img src="/logo.png" alt="" width="36" height="36" />
          <span>KCOM Admin</span>
        </div>
        <nav>
          {navFor(user.role).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className="kc-admin__link"
            >
              {item.label}
              {item.path === "/inbox" && <CountBadge count={unread} label="unread messages" />}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="kc-admin__scrim" onClick={closeDrawer} aria-hidden="true" />}
      <div className="kc-admin__main">
        <header className="kc-admin__bar">
          <Button
            ref={burgerRef}
            variant="secondary"
            className="kc-admin__burger"
            aria-label="Menu"
            aria-controls="admin-nav"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </Button>
          <span className="kc-admin__title">{title}</span>
          <Menu
            className="kc-admin__user"
            align="end"
            triggerLabel="Account menu"
            hideChevron
            trigger={<Avatar name={user.name} size="sm" />}
          >
            <MenuLabel className="kc-admin__who">
              <strong>{user.name}</strong>
              <Tag>{capitalise(user.role)}</Tag>
            </MenuLabel>
            <MenuItem onClick={() => navigate("/profile")}>Profile</MenuItem>
            {siteUrl && (
              <MenuItem href={siteUrl} target="_blank" rel="noopener noreferrer">
                View site
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem
              onClick={async () => {
                await signOut();
                navigate("/sign-in", { replace: true });
              }}
            >
              Sign out
            </MenuItem>
          </Menu>
        </header>
        <main className="kc-admin__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
