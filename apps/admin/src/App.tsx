import type { ReactElement } from "react";
import { Route, Routes } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth, RequirePermission } from "./auth/guards";
import { navItems } from "./shell/nav";
import { Shell } from "./shell/Shell";
import { DashboardPage } from "./pages/DashboardPage";
import { EventsPage } from "./events/EventsPage";
import { SubscribersPage } from "./subscribers/SubscribersPage";
import { InboxPage } from "./inbox/InboxPage";
import { DemoPage } from "./pages/DemoPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { BlogEditorPage } from "./blog/BlogEditorPage";
import { BlogPage } from "./blog/BlogPage";
import { CalendarPage } from "./capsules/CalendarPage";
import { CapsuleEditorStubPage } from "./capsules/CapsuleEditorStubPage";
import { CapsulesPage } from "./capsules/CapsulesPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SignInPage } from "./pages/SignInPage";

// Capsules and Calendar have their own pages below.
const BUILT = new Set(["/", "/capsules", "/calendar", "/blog"]);
const sections = navItems.filter((item) => !BUILT.has(item.path));

/** Pages built so far, by nav path. Sections not listed show the placeholder. */
const pages: Partial<Record<string, ReactElement>> = {
  "/events": <EventsPage />,
  "/inbox": <InboxPage />,
  "/subscribers": <SubscribersPage />,
};

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/forgot-password" element={<PlaceholderPage title="Forgot password" />} />
          <Route path="/sign-in" element={<SignInPage />} />
          {import.meta.env.DEV && <Route path="/demo" element={<DemoPage />} />}
          <Route element={<RequireAuth />}>
            <Route element={<Shell />}>
              <Route index element={<DashboardPage />} />
              <Route path="profile" element={<PlaceholderPage title="Profile" />} />
              <Route element={<RequirePermission permission="content:read" />}>
                <Route path="capsules" element={<CapsulesPage />} />
                <Route path="capsules/new" element={<CapsuleEditorStubPage isNew />} />
                <Route path="capsules/:id" element={<CapsuleEditorStubPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="blog" element={<BlogPage />} />
                <Route path="blog/new" element={<BlogEditorPage isNew />} />
                <Route path="blog/:id" element={<BlogEditorPage />} />
              </Route>
              {sections.map((item) => (
                <Route key={item.path} element={<RequirePermission permission={item.permission} />}>
                  <Route
                    path={`${item.path}/*`}
                    element={pages[item.path] ?? <PlaceholderPage title={item.label} />}
                  />
                </Route>
              ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
