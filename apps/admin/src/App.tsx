import { Route, Routes } from "react-router";
import { ToastProvider } from "@kcom/ui";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth, RequirePermission } from "./auth/guards";
import { navItems } from "./shell/nav";
import { Shell } from "./shell/Shell";
import { DashboardPage } from "./pages/DashboardPage";
import { DemoPage } from "./pages/DemoPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SignInPage } from "./pages/SignInPage";

const sections = navItems.filter((item) => item.path !== "/");

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
              {sections.map((item) => (
                <Route key={item.path} element={<RequirePermission permission={item.permission} />}>
                  <Route path={`${item.path}/*`} element={<PlaceholderPage title={item.label} />} />
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
