import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Avatar, Badge, Button, Menu, MenuItem, MenuLabel, MenuSeparator } from "@kcom/ui";
import { useAuth } from "../auth/AuthProvider";
import { navFor, navItemFor } from "./nav";

const siteUrl = import.meta.env.VITE_SITE_URL ?? "/";

/** Side menu, top bar and content outlet for every signed-in page. */
export function Shell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const barRef = useRef<HTMLElement>(null);
  const focusBurger = () =>
    barRef.current?.querySelector<HTMLElement>(".kc-admin__burger")?.focus();
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
      <aside ref={sideRef} className="kc-admin__side" id="admin-nav" aria-label="Main">
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
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="kc-admin__scrim" onClick={closeDrawer} aria-hidden="true" />}
      <div className="kc-admin__main">
        <header ref={barRef} className="kc-admin__bar">
          <Button
            variant="secondary"
            size="md"
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
            triggerLabel={`Account menu for ${user.name}`}
            trigger={<Avatar name={user.name} size="sm" />}
          >
            <MenuLabel className="kc-admin__who">
              <strong>{user.name}</strong>
              <Badge variant={user.role === "admin" ? "published" : "scheduled"}>{user.role}</Badge>
            </MenuLabel>
            <MenuItem onClick={() => navigate("/profile")}>Profile</MenuItem>
            <MenuItem href={siteUrl} target="_blank" rel="noopener noreferrer">
              View site
            </MenuItem>
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
