import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileClock,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getAuditLogRequest, getAuditLogsRequest } from "../api/auditLogs";
import FormSelect from "../components/forms/FormSelect";
import PaginationBar from "../components/tables/PaginationBar";
import { formatDate } from "../utils/formatters";
import "../styles/audit-logs.css";
import "../styles/audit-log-readable-detail.css";

const ACTIONS = {
  CREATE: "Dibuat",
  UPDATE: "Diperbarui",
  DELETE: "Dihapus",
  PROCESS: "Diproses",
};
const MODULES = {
  users: "Pengguna",
  suppliers: "Supplier",
  categories: "Kategori",
  products: "Produk",
  "purchase-orders": "Purchase Order",
  "goods-receipts": "Penerimaan Barang",
  customers: "Customer",
  "sales-orders": "Sales Order",
  deliveries: "Pengiriman",
  invoices: "Invoice Pelanggan",
  payments: "Pembayaran Pelanggan",
  "supplier-invoices": "Tagihan Supplier",
  "stock-opnames": "Stock Opname",
  "payment-settings": "Pengaturan Pembayaran",
  "code-number-settings": "Pengaturan Penomoran",
  "master-data-import": "Impor Master Data",
};
const FIELD_LABELS = {
  id: "ID data",
  username: "Username",
  full_name: "Nama lengkap",
  role: "Peran",
  status: "Status",
  supplier_code: "Kode supplier",
  supplier_name: "Nama supplier",
  category_code: "Kode kategori",
  category_name: "Nama kategori",
  sku: "SKU",
  product_name: "Nama produk",
  customer_code: "Kode customer",
  customer_name: "Nama customer",
  contact_person: "Kontak",
  phone: "Nomor telepon",
  email: "Email",
  address: "Alamat",
  city: "Kota",
  payment_terms_days: "Termin pembayaran",
  payment_scheme: "Skema pembayaran",
  down_payment_percent: "Persentase DP",
  credit_limit: "Limit kredit",
  unit: "Satuan",
  purchase_price: "Harga beli",
  selling_price: "Harga jual",
  minimum_stock: "Stok minimum",
  current_stock: "Stok saat ini",
  description: "Deskripsi",
  notes: "Catatan",
  po_number: "Nomor purchase order",
  so_number: "Nomor sales order",
  receipt_number: "Nomor penerimaan",
  delivery_number: "Nomor pengiriman",
  invoice_number: "Nomor invoice",
  payment_number: "Nomor pembayaran",
  opname_number: "Nomor stock opname",
  opname_date: "Tanggal penghitungan",
  order_date: "Tanggal pesanan",
  expected_date: "Tanggal perkiraan",
  delivery_date: "Tanggal pengiriman",
  invoice_date: "Tanggal invoice",
  due_date: "Tanggal jatuh tempo",
  payment_date: "Tanggal pembayaran",
  amount: "Nominal",
  total_amount: "Total",
  paid_amount: "Sudah dibayar",
  outstanding_amount: "Sisa tagihan",
  quantity: "Jumlah",
  system_quantity: "Stok sistem",
  counted_quantity: "Stok fisik",
  variance: "Selisih stok",
  items: "Daftar item",
  is_automatic: "Penomoran otomatis",
  prefix: "Awalan kode",
  separator: "Pemisah",
  digit_length: "Jumlah digit",
  include_year: "Sertakan tahun",
  include_month: "Sertakan bulan",
  reset_rule: "Aturan reset",
  next_number: "Nomor berikutnya",
  module: "Modul",
  imported: "Jumlah data berhasil",
  rows: "Baris impor",
  approval_status: "Status persetujuan",
  decision: "Keputusan",
  reason: "Alasan",
  rejection_reason: "Alasan penolakan",
  submitted_at: "Waktu pengajuan",
  decided_at: "Waktu keputusan",
};
const VALUE_LABELS = {
  ACTIVE: "Aktif",
  INACTIVE: "Tidak aktif",
  DRAFT: "Draf",
  SUBMITTED: "Diajukan",
  CONFIRMED: "Dikonfirmasi",
  CANCELLED: "Dibatalkan",
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  RECEIVED: "Diterima",
  DELIVERED: "Terkirim",
  PAID: "Lunas",
  PARTIAL: "Dibayar sebagian",
  UNPAID: "Belum dibayar",
  OVERDUE: "Jatuh tempo",
  DIRECT: "Pembayaran langsung",
  TERM: "Termin",
  DOWN_PAYMENT: "Uang muka",
  COD: "Bayar di tempat",
  NEVER: "Tidak pernah",
  YEARLY: "Setiap tahun",
  MONTHLY: "Setiap bulan",
};
const TECHNICAL_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "submitted_by",
  "decided_by",
]);
const isTechnicalField = (key) =>
  TECHNICAL_FIELDS.has(key) || key.endsWith("_id");
const ACTION_OPTIONS = Object.entries(ACTIONS).map(([value, label]) => ({
  value,
  label,
}));
const MODULE_OPTIONS = Object.entries(MODULES).map(([value, label]) => ({
  value,
  label,
}));
const formatDateTime = (value) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const hasData = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined && value !== "";
};
const fieldLabel = (key) =>
  FIELD_LABELS[key] ||
  String(key)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("id-ID"));
const isCurrencyField = (key) =>
  /(?:amount|price|credit_limit|subtotal|total)$/i.test(key);
const isDateField = (key) => /(?:_at|_date|date)$/i.test(key);
const formatAuditValue = (key, value) => {
  if (value === null || value === undefined || value === "") return "Tidak diisi";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (key === "module" && MODULES[value]) return MODULES[value];
  if (VALUE_LABELS[value]) return VALUE_LABELS[value];
  if (isCurrencyField(key) && Number.isFinite(Number(value))) {
    return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))}`;
  }
  if (key.endsWith("_percent") && Number.isFinite(Number(value))) return `${value}%`;
  if (key === "payment_terms_days" && Number.isFinite(Number(value))) return `${value} hari`;
  if (isDateField(key) && typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return formatDateTime(value);
  }
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
    return "Tidak tersedia";
  }
  return String(value);
};
const AuditValue = ({ field, value, depth = 0 }) => {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="audit-empty-value">Tidak ada</span>;
    return (
      <div className="audit-value-list">
        {value.map((item, index) => (
          <article key={`${field}-${index}`}>
            <strong>Item {index + 1}</strong>
            {item && typeof item === "object" ? (
              <div className="audit-nested-fields">
                {Object.entries(item)
                  .filter(([key]) => !isTechnicalField(key))
                  .map(([key, nestedValue]) => (
                    <div key={key}>
                      <span>{fieldLabel(key)}</span>
                      <AuditValue field={key} value={nestedValue} depth={depth + 1} />
                    </div>
                  ))}
              </div>
            ) : (
              <span>{formatAuditValue(field, item)}</span>
            )}
          </article>
        ))}
      </div>
    );
  }
  if (value && typeof value === "object" && Object.keys(value).length > 0 && depth < 2) {
    return (
      <div className="audit-nested-fields">
        {Object.entries(value)
          .filter(([key]) => !isTechnicalField(key))
          .map(([key, nestedValue]) => (
            <div key={key}>
              <span>{fieldLabel(key)}</span>
              <AuditValue field={key} value={nestedValue} depth={depth + 1} />
            </div>
          ))}
      </div>
    );
  }
  return <span>{formatAuditValue(field, value)}</span>;
};
const DataFields = ({ value }) => {
  if (!hasData(value)) return <p className="audit-no-data">Tidak ada data.</p>;
  return (
    <div className="audit-field-grid">
      {Object.entries(value)
        .filter(([key]) => !isTechnicalField(key))
        .map(([key, fieldValue]) => (
          <article
            className={fieldValue && typeof fieldValue === "object" ? "is-wide" : ""}
            key={key}
          >
            <span>{fieldLabel(key)}</span>
            <AuditValue field={key} value={fieldValue} />
          </article>
        ))}
    </div>
  );
};
const valuesMatch = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const ChangeSummary = ({ previous, result, submitted }) => {
  const before = previous || {};
  const after = { ...before, ...(submitted || {}), ...(result || {}) };
  const fields = [...new Set([...Object.keys(before), ...Object.keys(submitted || {}), ...Object.keys(result || {})])]
    .filter((key) => !isTechnicalField(key) && !valuesMatch(before[key], after[key]));
  if (fields.length === 0) {
    return <p className="audit-no-data">Tidak ada perubahan nilai yang dapat dibandingkan.</p>;
  }
  return (
    <div className="audit-change-list">
      {fields.map((key) => (
        <article key={key}>
          <span className="audit-change-label">{fieldLabel(key)}</span>
          <div className="audit-change-values">
            <div><small>Sebelum</small><AuditValue field={key} value={before[key]} /></div>
            <ArrowRight aria-hidden="true" />
            <div><small>Sesudah</small><AuditValue field={key} value={after[key]} /></div>
          </div>
        </article>
      ))}
    </div>
  );
};
const getEntityLabel = (row) =>
  row.entity_label ||
  (row.module === "master-data-import" ? "Impor Master Data" : "Data");
const getActivityDescription = (row) =>
  row.module === "master-data-import"
    ? "Mengimpor master data melalui Excel"
    : `${ACTIONS[row.action] || row.action} pada ${MODULES[row.module] || row.module}`;

const AuditLogsPage = () => {
  const [rows, setRows] = useState([]),
    [pagination, setPagination] = useState({
      page: 1,
      total: 0,
      total_pages: 0,
    }),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [action, setAction] = useState(""),
    [module, setModule] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [detail, setDetail] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const result = await getAuditLogsRequest({
          page,
          limit: 20,
          ...(query && { search: query }),
          ...(action && { action }),
          ...(module && { module }),
        });
        if (!cancelled) {
          setRows(result.data);
          setPagination(result.pagination);
        }
      } catch (err) {
        if (!cancelled)
          setError(err.response?.data?.message || "Audit log gagal dimuat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, query, action, module, reload]);
  const openDetail = async (id) => {
    try {
      setDetail(await getAuditLogRequest(id));
    } catch (err) {
      setError(err.response?.data?.message || "Detail audit log gagal dimuat.");
    }
  };
  const hasActiveFilters = Boolean(search || query || action || module);
  const resetFilters = () => {
    setSearch("");
    setQuery("");
    setAction("");
    setModule("");
    setPage(1);
  };
  return (
    <div className="audit-page">
      <section className="page-heading">
        <div>
          <p>Administration</p>
          <h2>Audit Log</h2>
          <span>
            Lacak perubahan data penting dan pengguna yang menjalankannya.
          </span>
        </div>
        <button
          className="secondary-action"
          onClick={() => setReload((x) => x + 1)}
        >
          <RefreshCw className={loading ? "is-spinning" : ""} />
          Muat ulang
        </button>
      </section>
      {error && (
        <div className="data-error">
          <AlertTriangle />
          <span>{error}</span>
        </div>
      )}
      <section className="data-panel">
        <form
          className="audit-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <div className="search-control">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pengguna, modul, atau data"
            />
            <button>Cari</button>
          </div>
          <FormSelect
            label="Aksi"
            value={action}
            options={ACTION_OPTIONS}
            placeholder="Semua aksi"
            searchable={false}
            disabled={loading}
            onChange={(value) => {
              setPage(1);
              setAction(value);
            }}
          />
          {hasActiveFilters && (
            <button
              type="button"
              className="reset-filter"
              onClick={resetFilters}
            >
              <X aria-hidden="true" />
              Reset
            </button>
          )}
          <FormSelect
            label="Modul"
            value={module}
            options={MODULE_OPTIONS}
            placeholder="Semua modul"
            searchPlaceholder="Cari modul..."
            disabled={loading}
            onChange={(value) => {
              setPage(1);
              setModule(value);
            }}
          />
        </form>
        <div className="table-summary">
          Menampilkan <strong>{rows.length}</strong> dari{" "}
          <strong>{pagination.total}</strong> aktivitas
        </div>
        <div className="data-table-wrapper">
          <table className="data-table audit-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Modul</th>
                <th>Data</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-message">
                    <RefreshCw className="is-spinning" />
                    Memuat aktivitas...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-message">
                    <FileClock />
                    Belum ada aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Waktu">
                      <strong>{formatDate(row.created_at)}</strong>
                      <small>
                        {formatDateTime(row.created_at).split(" pukul ").at(-1)}
                      </small>
                    </td>
                    <td data-label="Pengguna">
                      <strong>{row.username || "Pengguna dihapus"}</strong>
                      <small>{row.user_role || "-"}</small>
                    </td>
                    <td data-label="Aksi">
                      <span
                        className={`audit-action is-${row.action.toLowerCase()}`}
                      >
                        {ACTIONS[row.action] || row.action}
                      </span>
                    </td>
                    <td data-label="Modul">
                      {MODULES[row.module] || row.module}
                    </td>
                    <td data-label="Data">
                      <strong>{getEntityLabel(row)}</strong>
                      <small>{getActivityDescription(row)}</small>
                    </td>
                    <td data-label="Detail">
                      <button
                        className="audit-detail-button"
                        onClick={() => openDetail(row.id)}
                      >
                        <Eye />
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalPages={Math.max(1, pagination.total_pages)}
          isLoading={loading}
          onPageChange={setPage}
        />
      </section>
      {detail && (
        <div
          className="audit-detail-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <section
            className="audit-detail-dialog"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>{MODULES[detail.module] || detail.module}</span>
                <h2>
                  {ACTIONS[detail.action] || detail.action} ·{" "}
                  {getEntityLabel(detail)}
                </h2>
                <p>
                  {detail.username || "Pengguna dihapus"} ·{" "}
                  {formatDateTime(detail.created_at)}
                </p>
              </div>
              <button onClick={() => setDetail(null)}>
                <X />
              </button>
            </header>
            <div className="audit-detail-body">
              <section className="audit-readable-section">
                <header>
                  <div className="audit-section-icon">
                    <CheckCircle2 aria-hidden="true" />
                  </div>
                  <div>
                    <h3>
                      {detail.action === "UPDATE"
                        ? "Ringkasan perubahan"
                        : detail.action === "DELETE"
                          ? "Data yang dihapus"
                          : detail.action === "CREATE"
                            ? "Data yang dibuat"
                            : "Hasil proses"}
                    </h3>
                    <p>
                      {detail.action === "UPDATE"
                        ? "Hanya nilai yang berubah yang ditampilkan."
                        : "Informasi utama dari aktivitas ini."}
                    </p>
                  </div>
                </header>

                {detail.action === "UPDATE" ? (
                  <ChangeSummary
                    previous={detail.previous_data}
                    submitted={detail.submitted_data}
                    result={detail.result_data}
                  />
                ) : (
                  <DataFields
                    value={
                      detail.action === "DELETE"
                        ? detail.previous_data
                        : hasData(detail.result_data)
                          ? detail.result_data
                          : detail.submitted_data
                    }
                  />
                )}
              </section>

            </div>
          </section>
        </div>
      )}
    </div>
  );
};
export default AuditLogsPage;
