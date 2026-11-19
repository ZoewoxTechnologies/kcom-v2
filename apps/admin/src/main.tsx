import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kcom/ui/tokens.css";
import "@kcom/ui/button.css";
import "@kcom/ui/avatar.css";
import "@kcom/ui/badge.css";
import "@kcom/ui/toast.css";
import "@kcom/ui/data-table.css";
import "@kcom/ui/dialog.css";
import "@kcom/ui/menu.css";
import "@kcom/ui/forms.css";
import "@kcom/ui/datetime-picker.css";
import "./shell/shell.css";
import { createBrowserRouter, RouterProvider } from "react-router";
import { App } from "./App";
import { initSentry } from "./sentry";

initSentry();

// A data router, so editors can block navigation while they have unsaved changes.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
