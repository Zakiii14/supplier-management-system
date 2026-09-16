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
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import GoodsReceiptsPage from "./pages/GoodsReceiptsPage";
import InventoryPage from "./pages/InventoryPage";
import InvoicesPage from "./pages/InvoicesPage";
import LoginPage from "./pages/LoginPage";
import MasterDataImportPage from "./pages/MasterDataImportPage";
import ModulePlaceholderPage from "./pages/ModulePlaceholderPage";
import PasswordSetupPage from "./pages/PasswordSetupPage";
import PaymentSettingsPage from "./pages/PaymentSettingsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ProductsPage from "./pages/ProductsPage";
import ProfilePage from "./pages/ProfilePage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseReturnsPage from "./pages/PurchaseReturnsPage";
import ReportsPage from "./pages/ReportsPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import SalesReturnsPage from "./pages/SalesReturnsPage";
import StockOpnamesPage from "./pages/StockOpnamesPage";
import SupplierInvoicesPage from "./pages/SupplierInvoicesPage";
import SuppliersPage from "./pages/SuppliersPage";
import TaxSettingsPage from "./pages/TaxSettingsPage";
import UsersPage from "./pages/UsersPage";
import CodeNumberSettingsPage from "./pages/CodeNumberSettingsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { navigationGroups } from "./utils/navigation";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  const moduleRoutes = navigationGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.path !== "/" &&
        item.path !== "/profile" &&
        item.path !== "/suppliers" &&
        item.path !== "/categories" &&
        item.path !== "/products" &&
        item.path !== "/purchase-orders" &&
        item.path !== "/goods-receipts" &&
        item.path !== "/inventory" &&
        item.path !== "/customers" &&
        item.path !== "/sales-orders" &&
        item.path !== "/deliveries" &&
        item.path !== "/invoices" &&
        item.path !== "/payments" &&
        item.path !== "/reports" &&
        item.path !== "/code-number-settings" &&
        item.path !== "/payment-settings" &&
        item.path !== "/tax-settings" &&
        item.path !== "/supplier-invoices" &&
        item.path !== "/audit-logs" &&
        item.path !== "/master-data-import" &&
        item.path !== "/stock-opnames" &&
        item.path !== "/purchase-returns" &&
        item.path !== "/sales-returns" &&
        item.path !== "/users",
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
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={<PasswordSetupPage mode="reset" />}
      />
      <Route
        path="/activate-account"
        element={<PasswordSetupPage mode="activation" />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="goods-receipts" element={<GoodsReceiptsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="stock-opnames" element={<StockOpnamesPage />} />
          <Route path="purchase-returns" element={<PurchaseReturnsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="sales-orders" element={<SalesOrdersPage />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="sales-returns" element={<SalesReturnsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="supplier-invoices" element={<SupplierInvoicesPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route
            path="master-data-import"
            element={<MasterDataImportPage />}
          />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route
            path="code-number-settings"
            element={<CodeNumberSettingsPage />}
          />
          <Route
            path="payment-settings"
            element={<PaymentSettingsPage />}
          />
          <Route path="tax-settings" element={<TaxSettingsPage />} />

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
