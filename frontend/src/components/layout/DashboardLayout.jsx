import { useState } from "react";
import {
  LogOut,
  Menu,
  PackageCheck,
  X,
} from "lucide-react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import useAuth from "../../hooks/useAuth";
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

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

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

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="dashboard-shell">
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
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut aria-hidden="true" />
            <span>Keluar</span>
          </button>
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

          <div className="dashboard-user">
            <span className="dashboard-user-avatar">
              {initials}
            </span>

            <div>
              <strong>{displayName}</strong>
              <span>
                {ROLE_LABELS[user.role] || user.role}
              </span>
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