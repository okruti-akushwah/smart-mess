import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import LanguageProvider from "./i18n/LanguageProvider";
import "./index.css";
import "./ui-refresh.css";
import "./tiffin-theme.css";

createRoot(
  document.getElementById("root")
).render(
  <StrictMode>
    <LanguageProvider><App /></LanguageProvider>
  </StrictMode>
);
