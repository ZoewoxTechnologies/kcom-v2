import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kcom/ui/tokens.css";
import "@kcom/ui/button.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
