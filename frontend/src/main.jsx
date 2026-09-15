import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import "./styles/components.css";
import "./styles/theme.css";
import "./styles/modern-interactive-charts.css";
import "./styles/modern-dashboard-layout.css";
import "./styles/user-mobile-name-fix.css";
import "./styles/ui-foundation-overrides.css";
import "./styles/component-consistency.css";
import "./styles/form-consistency.css";
import "./styles/page-consistency.css";
import "./styles/responsive-verification.css";

const THEME_STORAGE_KEY = "supplyflow-theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

const readThemePreference = () => {
  try {
    const storedTheme = window.localStorage.getItem(
      THEME_STORAGE_KEY,
    );

    return ["light", "dark", "system"].includes(storedTheme)
      ? storedTheme
      : "system";
  } catch {
    return "system";
  }
};

const applyThemePreference = (preference, mediaQuery) => {
  const resolvedTheme =
    preference === "system"
      ? mediaQuery.matches
        ? "dark"
        : "light"
      : preference;

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
};

const systemThemeQuery = window.matchMedia(SYSTEM_THEME_QUERY);

applyThemePreference(
  readThemePreference(),
  systemThemeQuery,
);

systemThemeQuery.addEventListener("change", () => {
  const preference = readThemePreference();

  if (preference === "system") {
    applyThemePreference(preference, systemThemeQuery);
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
