import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  X,
} from "lucide-react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import UserAvatar from "../users/UserAvatar";
import NotificationCenter from "./NotificationCenter";
import NotificationTargetFocus from "./NotificationTargetFocus";
import { navigationGroups } from "../../utils/navigation";
import "../../styles/dashboard.css";

const ROLE_LABELS = {
  ADMIN: "Administrator",
  PURCHASING: "Purchasing",
  WAREHOUSE: "Warehouse",
  SALES: "Sales",
  FINANCE: "Finance",
  MANAGER: "Manager",
};

const THEME_OPTIONS = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Ikuti sistem", icon: Monitor },
];

const readStoredValue = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(
      () =>
        readStoredValue("supplyflow-sidebar", "expanded") ===
        "collapsed",
    );
  const [themePreference, setThemePreference] = useState(
    () => readStoredValue("supplyflow-theme", "system"),
  );
  const [isUserMenuOpen, setIsUserMenuOpen] =
    useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );

    const applyTheme = () => {
      const resolvedTheme =
        themePreference === "system"
          ? mediaQuery.matches
            ? "dark"
            : "light"
          : themePreference;

      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    try {
      window.localStorage.setItem(
        "supplyflow-theme",
        themePreference,
      );
    } catch {
      // The preference still works for the current session.
    }

    return () =>
      mediaQuery.removeEventListener("change", applyTheme);
  }, [themePreference]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.roles.includes(user.role),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const currentPage = navigationGroups
    .flatMap((group) => group.items)
    .find((item) => item.path === location.pathname);

  const displayName =
    user.full_name || user.username || "User";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleDesktopSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const nextValue = !current;

      try {
        window.localStorage.setItem(
          "supplyflow-sidebar",
          nextValue ? "collapsed" : "expanded",
        );
      } catch {
        // The state still works for the current session.
      }

      return nextValue;
    });
  };

  return (
    <div
      className={`dashboard-shell ${
        isSidebarCollapsed ? "is-sidebar-collapsed" : ""
      }`}
    >
      <NotificationTargetFocus />
      <button
        type="button"
        className={`sidebar-overlay ${
          isSidebarOpen ? "is-visible" : ""
        }`}
        onClick={closeSidebar}
        aria-label="Tutup menu navigasi"
      />

      <aside
        className={`dashboard-sidebar ${
          isSidebarOpen ? "is-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">
            <PackageCheck aria-hidden="true" />
          </span>

          <div>
            <strong>SupplyFlow</strong>
            <span>Management System</span>
          </div>

          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={toggleDesktopSidebar}
            aria-label={
              isSidebarCollapsed
                ? "Perluas sidebar"
                : "Minimalkan sidebar"
            }
            title={
              isSidebarCollapsed
                ? "Perluas sidebar"
                : "Minimalkan sidebar"
            }
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Tutup sidebar"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav
          className="sidebar-navigation"
          aria-label="Navigasi utama"
        >
          {visibleGroups.map((group, groupIndex) => (
            <div
              className="sidebar-group"
              key={group.label || groupIndex}
            >
              {group.label && (
                <p className="sidebar-group-label">
                  {group.label}
                </p>
              )}

              <div className="sidebar-links">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      onClick={closeSidebar}
                      title={
                        isSidebarCollapsed
                          ? item.label
                          : undefined
                      }
                      className={({ isActive }) =>
                        `sidebar-link ${
                          isActive ? "is-active" : ""
                        }`
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account-card">
            <UserAvatar
              user={user}
              className="sidebar-account-avatar"
            />

            <div className="sidebar-account-copy">
              <strong>{displayName}</strong>
              <span>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>

            <button
              type="button"
              className="sidebar-account-logout"
              onClick={handleLogout}
              aria-label="Keluar dari akun"
              title="Keluar dari akun"
            >
              <LogOut aria-hidden="true" />
            </button>
          </div>

          <p className="sidebar-copyright" title={`© ${new Date().getFullYear()} Zakilabs`}>
            <span>© {new Date().getFullYear()} Zakilabs</span>
          </p>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header-title">
            <button
              type="button"
              className="sidebar-menu-button"
              onClick={() =>
                setIsSidebarOpen((current) => !current)
              }
              aria-label="Buka menu navigasi"
            >
              <Menu aria-hidden="true" />
            </button>

            <div>
              <p>Supplier Management System</p>
              <h1>{currentPage?.label || "Dashboard"}</h1>
            </div>
          </div>

          <div className="dashboard-header-actions">
          <NotificationCenter />
          <div className="dashboard-user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="dashboard-user"
              onClick={() =>
                setIsUserMenuOpen((current) => !current)
              }
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
            >
              <UserAvatar user={user} className="dashboard-user-avatar" />

              <span className="dashboard-user-copy">
                <strong>{displayName}</strong>
                <span>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </span>

              <ChevronDown
                className="dashboard-user-chevron"
                aria-hidden="true"
              />
            </button>

            {isUserMenuOpen && (
              <div
                className="dashboard-user-dropdown"
                role="menu"
              >
                <div className="dashboard-user-dropdown-identity">
                  <UserAvatar user={user} className="dashboard-user-avatar" />
                  <div>
                    <strong>{displayName}</strong>
                    <span>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </div>
                </div>

                <div className="dashboard-theme-section">
                  <span>Tampilan</span>
                  <div className="dashboard-theme-options">
                    {THEME_OPTIONS.map((option) => {
                      const Icon = option.icon;

                      return (
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={
                            themePreference === option.value
                          }
                          className={
                            themePreference === option.value
                              ? "is-selected"
                              : ""
                          }
                          key={option.value}
                          onClick={() =>
                            setThemePreference(option.value)
                          }
                        >
                          <Icon aria-hidden="true" />
                          <span>{option.label}</span>
                          {themePreference === option.value && (
                            <Check aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  className="dashboard-dropdown-logout"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <LogOut aria-hidden="true" />
                  <span>Keluar dari akun</span>
                </button>
              </div>
            )}
          </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
