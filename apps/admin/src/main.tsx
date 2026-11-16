import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kcom/ui/tokens.css";
import "@kcom/ui/button.css";
import "@kcom/ui/toast.css";
import "@kcom/ui/data-table.css";
import "@kcom/ui/dialog.css";
import "@kcom/ui/forms.css";
import { App } from "./App";
import { initSentry } from "./sentry";

initSentry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
