import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import useAuth from "./hooks/useAuth";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ModulePlaceholderPage from "./pages/ModulePlaceholderPage";
import ProductsPage from "./pages/ProductsPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { navigationGroups } from "./utils/navigation";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  const moduleRoutes = navigationGroups
  .flatMap((group) => group.items)
  .filter(
    (item) =>
      item.path !== "/" &&
      item.path !== "/products",
  );

  const loginElement = isLoading ? (
    <main className="session-loading">
      <div
        className="session-loading-spinner"
        aria-hidden="true"
      />
      <p>Memeriksa sesi pengguna...</p>
    </main>
  ) : isAuthenticated ? (
    <Navigate to="/" replace />
  ) : (
    <LoginPage />
  );

  return (
    <Routes>
      <Route path="/login" element={loginElement} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          {moduleRoutes.map((item) => (
            <Route
              key={item.path}
              path={item.path.slice(1)}
              element={<ModulePlaceholderPage />}
            />
          ))}
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={isAuthenticated ? "/" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
};

export default App;