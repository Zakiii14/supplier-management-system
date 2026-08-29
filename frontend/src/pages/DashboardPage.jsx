import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Truck,
  UserCog,
  UsersRound,
  WalletCards,
  Warehouse,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { getDashboardSummaryRequest } from "../api/dashboard";
import useAuth from "../hooks/useAuth";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../utils/formatters";
import { navigationGroups } from "../utils/navigation";

const sectionPresentation = {
  inventory: {
    title: "Persediaan",
    description:
      "Kondisi produk dan stok saat ini.",
    icon: Warehouse,
    path: "/inventory",
    metrics: [
      {
        key: "active_products",
        label: "Produk aktif",
        icon: Boxes,
        format: "number",
      },
      {
        key: "low_stock_products",
        label: "Stok menipis",
        icon: AlertTriangle,
        format: "number",
        tone: "warning",
      },
      {
        key: "total_stock_units",
        label: "Total unit stok",
        icon: PackageCheck,
        format: "number",
      },
    ],
  },
  purchasing: {
    title: "Pembelian",
    description:
      "Ringkasan supplier dan pesanan pembelian.",
    icon: ShoppingCart,
    path: "/purchase-orders",
    metrics: [
      {
        key: "active_suppliers",
        label: "Supplier aktif",
        icon: Building2,
        format: "number",
      },
      {
        key: "open_purchase_orders",
        label: "PO masih berjalan",
        icon: ShoppingCart,
        format: "number",
      },
      {
        key: "pending_receipt_quantity",
        label: "Unit belum diterima",
        icon: PackageOpen,
        format: "number",
        tone: "warning",
      },
      {
        key: "inventory_value",
        label: "Nilai persediaan",
        icon: CircleDollarSign,
        format: "currency",
      },
    ],
  },
  sales: {
    title: "Penjualan",
    description:
      "Aktivitas customer, pesanan, dan pengiriman.",
    icon: ClipboardCheck,
    path: "/sales-orders",
    metrics: [
      {
        key: "active_customers",
        label: "Customer aktif",
        icon: UsersRound,
        format: "number",
      },
      {
        key: "open_sales_orders",
        label: "SO masih berjalan",
        icon: ClipboardCheck,
        format: "number",
      },
      {
        key: "pending_deliveries",
        label: "Pengiriman diproses",
        icon: Truck,
        format: "number",
        tone: "warning",
      },
    ],
  },
  finance: {
    title: "Keuangan",
    description:
      "Posisi tagihan dan pembayaran berjalan.",
    icon: WalletCards,
    path: "/invoices",
    metrics: [
      {
        key: "outstanding_invoices",
        label: "Invoice belum lunas",
        icon: ReceiptText,
        format: "number",
      },
      {
        key: "overdue_invoices",
        label: "Invoice jatuh tempo",
        icon: CalendarClock,
        format: "number",
        tone: "danger",
      },
      {
        key: "outstanding_amount",
        label: "Sisa piutang",
        icon: CircleDollarSign,
        format: "currency",
        tone: "warning",
      },
      {
        key: "payments_this_month",
        label: "Pembayaran bulan ini",
        icon: WalletCards,
        format: "number",
      },
      {
        key: "payments_this_month_amount",
        label: "Nominal diterima",
        icon: CheckCircle2,
        format: "currency",
        tone: "success",
      },
    ],
  },
  administration: {
    title: "Administrasi",
    description:
      "Ringkasan pengguna aktif dalam sistem.",
    icon: UserCog,
    path: "/users",
    metrics: [
      {
        key: "active_users",
        label: "Pengguna aktif",
        icon: UserCog,
        format: "number",
      },
    ],
  },
};

const activityPresentation = {
  PURCHASE_ORDER: {
    label: "Purchase order",
    icon: ShoppingCart,
    path: "/purchase-orders",
    className: "is-purchasing",
  },
  GOODS_RECEIPT: {
    label: "Penerimaan barang",
    icon: PackageOpen,
    path: "/goods-receipts",
    className: "is-inventory",
  },
  INVENTORY_MOVEMENT: {
    label: "Pergerakan stok",
    icon: Warehouse,
    path: "/inventory",
    className: "is-inventory",
  },
  SALES_ORDER: {
    label: "Sales order",
    icon: ClipboardCheck,
    path: "/sales-orders",
    className: "is-sales",
  },
  DELIVERY: {
    label: "Pengiriman",
    icon: Truck,
    path: "/deliveries",
    className: "is-delivery",
  },
  INVOICE: {
    label: "Invoice",
    icon: ReceiptText,
    path: "/invoices",
    className: "is-finance",
  },
  PAYMENT: {
    label: "Pembayaran",
    icon: WalletCards,
    path: "/payments",
    className: "is-finance",
  },
};

const statusLabels = {
  DRAFT: "Draf",
  SUBMITTED: "Diajukan",
  PARTIALLY_RECEIVED: "Diterima sebagian",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
  CONFIRMED: "Dikonfirmasi",
  PARTIALLY_DELIVERED: "Dikirim sebagian",
  DELIVERED: "Terkirim",
  PENDING: "Menunggu",
  SHIPPED: "Dikirim",
  UNPAID: "Belum dibayar",
  PARTIAL: "Dibayar sebagian",
  PAID: "Lunas",
  OVERDUE: "Jatuh tempo",
  BANK_TRANSFER: "Transfer bank",
  CASH: "Tunai",
  GIRO: "Giro",
  OTHER: "Lainnya",
  PURCHASE: "Pembelian",
  SALE: "Penjualan",
  ADJUSTMENT_IN: "Penyesuaian masuk",
  ADJUSTMENT_OUT: "Penyesuaian keluar",
  RETURN_IN: "Retur masuk",
  RETURN_OUT: "Retur keluar",
};

const formatMetricValue = (value, format) =>
  format === "currency"
    ? formatCurrency(value)
    : formatNumber(value);

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const OperationalSection = ({
  sectionKey,
  data,
}) => {
  const presentation =
    sectionPresentation[sectionKey];

  if (!presentation) {
    return null;
  }

  const SectionIcon = presentation.icon;

  return (
    <article
      className={`dashboard-operation-card is-${sectionKey}`}
    >
      <div className="dashboard-operation-heading">
        <span className="dashboard-operation-icon">
          <SectionIcon aria-hidden="true" />
        </span>

        <div>
          <h3>{presentation.title}</h3>
          <p>{presentation.description}</p>
        </div>

        <Link
          to={presentation.path}
          aria-label={`Buka modul ${presentation.title}`}
        >
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className="dashboard-operation-metrics">
        {presentation.metrics.map((metric) => {
          const MetricIcon = metric.icon;

          return (
            <div
              className={`dashboard-operation-metric${
                metric.tone
                  ? ` is-${metric.tone}`
                  : ""
              }`}
              key={metric.key}
            >
              <span>
                <MetricIcon aria-hidden="true" />
              </span>

              <div>
                <p>{metric.label}</p>
                <strong>
                  {formatMetricValue(
                    data[metric.key],
                    metric.format,
                  )}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();

  const [summary, setSummary] =
    useState(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [reloadKey, setReloadKey] =
    useState(0);

  useEffect(() => {
    let isCancelled = false;

    const fetchDashboardSummary = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const data =
          await getDashboardSummaryRequest();

        if (!isCancelled) {
          setSummary(data);
        }
      } catch (error) {
        if (!isCancelled) {
          setSummary(null);
          setErrorMessage(
            error.response?.data?.message ||
              "Ringkasan dashboard gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDashboardSummary();

    return () => {
      isCancelled = true;
    };
  }, [reloadKey]);

  const availableModules = navigationGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.path !== "/" &&
        item.roles.includes(user.role),
    );

  const currentDate = new Intl.DateTimeFormat(
    "id-ID",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(new Date());

  const sections = summary?.sections ?? {};
  const sectionEntries = Object.entries(sections);
  const lowStockProducts =
    summary?.alerts?.low_stock_products ?? [];
  const overdueInvoices =
    summary?.alerts?.overdue_invoices ?? [];
  const recentActivity =
    summary?.recent_activity ?? [];
  const alertCount =
    lowStockProducts.length + overdueInvoices.length;

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <p className="dashboard-date">
            {currentDate}
          </p>

          <h2>
            Selamat datang,{" "}
            {user.full_name || user.username}.
          </h2>

          <p>
            Pantau kondisi operasional SupplyFlow
            berdasarkan akses dan tanggung jawab
            akunmu.
          </p>

          <div className="dashboard-welcome-meta">
            <span>{user.role}</span>

            <span>
              {availableModules.length} modul tersedia
            </span>

            {summary?.generated_at && (
              <span>
                Diperbarui{" "}
                {formatDateTime(
                  summary.generated_at,
                )}
              </span>
            )}
          </div>
        </div>

        <button
          className="dashboard-refresh-button"
          type="button"
          onClick={() =>
            setReloadKey((current) => current + 1)
          }
          disabled={isLoading}
        >
          <RefreshCw aria-hidden="true" />
          <span>
            {isLoading
              ? "Memuat..."
              : "Perbarui data"}
          </span>
        </button>
      </section>

      {isLoading && !summary && (
        <section
          className="dashboard-state-card is-loading"
          aria-live="polite"
        >
          <RefreshCw aria-hidden="true" />

          <div>
            <h2>Memuat ringkasan operasional</h2>
            <p>
              Data terbaru sedang diambil dari sistem.
            </p>
          </div>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section
          className="dashboard-state-card is-error"
          role="alert"
        >
          <AlertCircle aria-hidden="true" />

          <div>
            <h2>Dashboard belum dapat dimuat</h2>
            <p>{errorMessage}</p>
          </div>

          <button
            type="button"
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
          >
            Coba lagi
          </button>
        </section>
      )}

      {summary && (
        <>
          <section className="dashboard-overview">
            <div className="dashboard-section-heading">
              <div>
                <p>Ringkasan utama</p>
                <h2>Kondisi operasional</h2>
              </div>

              <span>
                {sectionEntries.length} area terpantau
              </span>
            </div>

            <div className="dashboard-operation-grid">
              {sectionEntries.map(
                ([sectionKey, data]) => (
                  <OperationalSection
                    sectionKey={sectionKey}
                    data={data}
                    key={sectionKey}
                  />
                ),
              )}
            </div>
          </section>

          <div className="dashboard-information-grid">
            <section className="dashboard-panel dashboard-alerts-panel">
              <div className="dashboard-section-heading">
                <div>
                  <p>Perlu perhatian</p>
                  <h2>Peringatan operasional</h2>
                </div>

                <span
                  className={
                    alertCount > 0
                      ? "is-warning"
                      : "is-clear"
                  }
                >
                  {alertCount > 0
                    ? `${alertCount} peringatan`
                    : "Kondisi aman"}
                </span>
              </div>

              {alertCount === 0 ? (
                <div className="dashboard-empty-state is-success">
                  <CheckCircle2 aria-hidden="true" />

                  <div>
                    <strong>
                      Tidak ada peringatan
                    </strong>
                    <p>
                      Kondisi yang dapat kamu akses
                      saat ini masih terkendali.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="dashboard-alert-groups">
                  {lowStockProducts.length > 0 && (
                    <div className="dashboard-alert-group">
                      <div className="dashboard-alert-title">
                        <span className="is-stock">
                          <AlertTriangle
                            aria-hidden="true"
                          />
                        </span>

                        <div>
                          <strong>Stok menipis</strong>
                          <p>
                            Produk telah mencapai batas
                            minimum stok.
                          </p>
                        </div>

                        <Link to="/products">
                          Lihat semua
                        </Link>
                      </div>

                      <div className="dashboard-alert-list">
                        {lowStockProducts.map(
                          (product) => (
                            <Link
                              className="dashboard-alert-item"
                              to="/products"
                              key={product.id}
                            >
                              <div>
                                <strong>
                                  {product.product_name}
                                </strong>
                                <span>
                                  {product.sku} ·{" "}
                                  {product.category_name}
                                </span>
                              </div>

                              <p>
                                <strong>
                                  {formatNumber(
                                    product.current_stock,
                                  )}{" "}
                                  {product.unit}
                                </strong>
                                <span>
                                  Minimum{" "}
                                  {formatNumber(
                                    product.minimum_stock,
                                  )}
                                </span>
                              </p>
                            </Link>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {overdueInvoices.length > 0 && (
                    <div className="dashboard-alert-group">
                      <div className="dashboard-alert-title">
                        <span className="is-invoice">
                          <CalendarClock
                            aria-hidden="true"
                          />
                        </span>

                        <div>
                          <strong>
                            Invoice jatuh tempo
                          </strong>
                          <p>
                            Tagihan memerlukan tindak
                            lanjut pembayaran.
                          </p>
                        </div>

                        <Link to="/invoices">
                          Lihat semua
                        </Link>
                      </div>

                      <div className="dashboard-alert-list">
                        {overdueInvoices.map(
                          (invoice) => (
                            <Link
                              className="dashboard-alert-item"
                              to="/invoices"
                              key={invoice.id}
                            >
                              <div>
                                <strong>
                                  {invoice.invoice_number}
                                </strong>
                                <span>
                                  {invoice.customer_name}
                                </span>
                              </div>

                              <p>
                                <strong>
                                  {formatCurrency(
                                    invoice.outstanding_amount,
                                  )}
                                </strong>
                                <span>
                                  Jatuh tempo{" "}
                                  {formatDate(
                                    invoice.due_date,
                                  )}
                                </span>
                              </p>
                            </Link>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

          </div>

          <section className="dashboard-panel dashboard-activity-panel">
            <div className="dashboard-section-heading">
              <div>
                <p>Aktivitas sistem</p>
                <h2>Aktivitas terbaru</h2>
              </div>

              <span>
                {recentActivity.length} aktivitas
              </span>
            </div>

            {recentActivity.length === 0 ? (
              <div className="dashboard-empty-state">
                <Activity aria-hidden="true" />

                <div>
                  <strong>
                    Belum ada aktivitas terbaru
                  </strong>
                  <p>
                    Aktivitas yang sesuai dengan role
                    akunmu akan muncul di sini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="dashboard-activity-list">
                {recentActivity.map((activity) => {
                  const presentation =
                    activityPresentation[
                      activity.activity_type
                    ] ?? {
                      label: "Aktivitas",
                      icon: Activity,
                      path: "/",
                      className: "is-default",
                    };

                  const ActivityIcon =
                    presentation.icon;

                  return (
                    <Link
                      className="dashboard-activity-item"
                      to={presentation.path}
                      key={`${activity.activity_type}-${activity.entity_id}`}
                    >
                      <span
                        className={`dashboard-activity-icon ${presentation.className}`}
                      >
                        <ActivityIcon
                          aria-hidden="true"
                        />
                      </span>

                      <div className="dashboard-activity-copy">
                        <p>{presentation.label}</p>
                        <strong>
                          {activity.reference_number}
                        </strong>
                        <span>{activity.subject}</span>
                      </div>

                      <div className="dashboard-activity-meta">
                        <span
                          className={`dashboard-activity-status is-${activity.status
                            .toLowerCase()
                            .replaceAll("_", "-")}`}
                        >
                          {statusLabels[activity.status] ||
                            activity.status}
                        </span>

                        <time
                          dateTime={activity.occurred_at}
                        >
                          <Clock3 aria-hidden="true" />
                          {formatDateTime(
                            activity.occurred_at,
                          )}
                        </time>
                      </div>

                      <ArrowRight
                        className="dashboard-activity-arrow"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
