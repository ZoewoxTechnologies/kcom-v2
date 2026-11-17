import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Avatar, Badge, Button, Menu, MenuItem, MenuLabel, MenuSeparator } from "@kcom/ui";
import { useAuth } from "../auth/AuthProvider";
import { navFor, navItems } from "./nav";

/** Side menu, top bar and content outlet for every signed-in page. */
export function Shell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (!user) return null;
  const title = navItems.find((i) =>
    i.path === "/" ? pathname === "/" : pathname.startsWith(i.path),
  )?.label;

  return (
    <div className="kc-admin" data-nav-open={open || undefined}>
      <aside className="kc-admin__side" id="admin-nav" aria-label="Main">
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
      {open && (
        <div className="kc-admin__scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      <div className="kc-admin__main">
        <header className="kc-admin__bar">
          <Button
            variant="tertiary"
            size="sm"
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
            trigger={
              <>
                <Avatar name={user.name} size="sm" />
                <span className="kc-admin__user-name">{user.name}</span>
              </>
            }
          >
            <MenuLabel>
              {user.name}{" "}
              <Badge variant={user.role === "admin" ? "published" : "scheduled"}>{user.role}</Badge>
            </MenuLabel>
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
