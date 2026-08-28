import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import useAuth from "./hooks/useAuth";
import CategoriesPage from "./pages/CategoriesPage";
import CustomersPage from "./pages/CustomersPage";
import DashboardPage from "./pages/DashboardPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import GoodsReceiptsPage from "./pages/GoodsReceiptsPage";
import InventoryPage from "./pages/InventoryPage";
import LoginPage from "./pages/LoginPage";
import ModulePlaceholderPage from "./pages/ModulePlaceholderPage";
import ProductsPage from "./pages/ProductsPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import SuppliersPage from "./pages/SuppliersPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { navigationGroups } from "./utils/navigation";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  const moduleRoutes = navigationGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.path !== "/" &&
        item.path !== "/suppliers" &&
        item.path !== "/categories" &&
        item.path !== "/products" &&
        item.path !== "/purchase-orders" &&
        item.path !== "/goods-receipts" &&
        item.path !== "/inventory" &&
        item.path !== "/customers" &&
        item.path !== "/sales-orders" &&
        item.path !== "/deliveries",
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
      <Route
        path="/login"
        element={loginElement}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route
            index
            element={<DashboardPage />}
          />

          <Route
            path="suppliers"
            element={<SuppliersPage />}
          />

          <Route
            path="categories"
            element={<CategoriesPage />}
          />

          <Route
            path="products"
            element={<ProductsPage />}
          />

          <Route
            path="purchase-orders"
            element={<PurchaseOrdersPage />}
          />

          <Route
            path="goods-receipts"
            element={<GoodsReceiptsPage />}
          />

          <Route
            path="inventory"
            element={<InventoryPage />}
          />

          <Route
            path="customers"
            element={<CustomersPage />}
          />

          <Route
            path="sales-orders"
            element={<SalesOrdersPage />}
          />

          <Route
            path="deliveries"
            element={<DeliveriesPage />}
          />

          {moduleRoutes.map((item) => (
            <Route
              key={item.path}
              path={item.path.slice(1)}
              element={
                <ModulePlaceholderPage />
              }
            />
          ))}
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={
              isAuthenticated
                ? "/"
                : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
};

export default App;