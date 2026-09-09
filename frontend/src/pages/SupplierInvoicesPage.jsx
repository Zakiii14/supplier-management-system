import {
  AlertTriangle,
  Eye,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getPurchaseOrdersRequest } from "../api/purchaseOrders";
import {
  deleteSupplierInvoiceAttachmentRequest,
  getSupplierInvoiceRequest,
  getSupplierInvoicesRequest,
  openSupplierInvoiceAttachmentRequest,
  saveSupplierInvoiceRequest,
} from "../api/supplierInvoices";
import StatusFilter from "../components/filters/StatusFilter";
import FormDatePicker from "../components/forms/FormDatePicker";
import FormSelect from "../components/forms/FormSelect";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import {
  formatCurrency,
  formatDate,
} from "../utils/formatters";
import "../styles/supplier-invoices.css";

const today = () =>
  new Date().toISOString().slice(0, 10);

const statusLabels = {
  UNPAID: "Belum dibayar",
  PARTIAL: "Dibayar sebagian",
  PAID: "Lunas",
  OVERDUE: "Terlambat",
};

const statusOptions = [
  { value: "", label: "Semua status" },
  ...Object.entries(statusLabels).map(
    ([value, label]) => ({ value, label }),
  ),
];

const InvoiceForm = ({
  invoice,
  purchaseOrders,
  onClose,
  onSaved,
}) => {
  const initialPo = invoice?.purchase_order_id || "";
  const [values, setValues] = useState({
    invoice_number: invoice?.invoice_number || "",
    purchase_order_id: initialPo,
    invoice_date:
      invoice?.invoice_date?.slice(0, 10) || today(),
    due_date:
      invoice?.due_date?.slice(0, 10) || today(),
    total_amount: invoice?.total_amount || "",
    notes: invoice?.notes || "",
  });
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const options = purchaseOrders.map((po) => ({
    value: po.id,
    label: `${po.po_number} · ${po.supplier_name} · ${formatCurrency(po.total_amount)}`,
  }));

  const submit = async (event) => {
    event.preventDefault();

    if (
      !values.invoice_number.trim() ||
      !values.purchase_order_id ||
      !values.invoice_date ||
      !values.due_date ||
      Number(values.total_amount) <= 0
    ) {
      setError(
        "Lengkapi nomor invoice, PO, tanggal, jatuh tempo, dan total tagihan.",
      );
      return;
    }

    try {
      setBusy(true);
      await saveSupplierInvoiceRequest(invoice?.id, {
        ...values,
        invoice_number: values.invoice_number.trim(),
        attachments,
      });
      onSaved();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Tagihan supplier gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="supplier-invoice-backdrop">
      <section
        className="supplier-invoice-modal"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span>FINANCE</span>
            <h2>
              {invoice
                ? "Edit tagihan supplier"
                : "Tambah tagihan supplier"}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Tutup form tagihan supplier"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="supplier-invoice-form-body">
            <label>
              <span>Nomor invoice supplier</span>
              <input
                value={values.invoice_number}
                placeholder="Contoh: INV-SUP/2026/001"
                onChange={(event) =>
                  setValues({
                    ...values,
                    invoice_number: event.target.value,
                  })
                }
              />
            </label>

            <div>
              <FormSelect
                label="Purchase order"
                value={values.purchase_order_id}
                options={options}
                placeholder="Pilih PO"
                disabled={Boolean(invoice)}
                onChange={(value) => {
                  const po = purchaseOrders.find(
                    (item) => item.id === value,
                  );
                  setValues({
                    ...values,
                    purchase_order_id: value,
                    total_amount:
                      po?.total_amount || values.total_amount,
                  });
                }}
              />
            </div>

            <div>
              <FormDatePicker
                label="Tanggal invoice"
                value={values.invoice_date}
                onChange={(value) =>
                  setValues({
                    ...values,
                    invoice_date: value,
                  })
                }
              />
            </div>

            <div>
              <FormDatePicker
                label="Jatuh tempo"
                value={values.due_date}
                min={values.invoice_date}
                onChange={(value) =>
                  setValues({
                    ...values,
                    due_date: value,
                  })
                }
              />
            </div>

            <label>
              <span>Total tagihan</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={values.total_amount}
                onChange={(event) =>
                  setValues({
                    ...values,
                    total_amount: event.target.value,
                  })
                }
              />
            </label>

            <label className="is-full">
              <span>Catatan</span>
              <textarea
                rows="3"
                value={values.notes}
                onChange={(event) =>
                  setValues({
                    ...values,
                    notes: event.target.value,
                  })
                }
              />
            </label>

            <label className="supplier-invoice-files is-full">
              <span>
                Lampiran invoice (PDF/JPG/PNG/WebP,
                maksimal 3 file)
              </span>
              <input
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setAttachments(
                    [...event.target.files].slice(0, 3),
                  )
                }
              />
              <small>
                {attachments.length
                  ? `${attachments.length} file dipilih`
                  : "Belum ada file baru dipilih"}
              </small>
            </label>

            {error && (
              <div className="supplier-invoice-error is-full">
                {error}
              </div>
            )}
          </div>

          <footer>
            <button
              type="button"
              className="is-cancel"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className="is-save"
              disabled={busy}
            >
              <Save aria-hidden="true" />
              {busy ? "Menyimpan..." : "Simpan tagihan"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

const SupplierInvoicesPage = () => {
  const { user } = useAuth();
  const canEdit = ["ADMIN", "FINANCE"].includes(
    user.role,
  );

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    total_pages: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null);
  const [pos, setPos] = useState([]);
  const [detail, setDetail] = useState(null);

  const hasActiveFilters = Boolean(
    search.trim() || query || status,
  );

  useEffect(() => {
    let cancel = false;

    const loadInvoices = async () => {
      try {
        setLoading(true);
        setError("");
        const result = await getSupplierInvoicesRequest({
          page,
          limit: 10,
          ...(query && { search: query }),
          ...(status && { status }),
        });

        if (!cancel) {
          setRows(result.data);
          setPagination(result.pagination);
        }
      } catch (requestError) {
        if (!cancel) {
          setError(
            requestError.response?.data?.message ||
              "Tagihan supplier gagal dimuat.",
          );
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };

    loadInvoices();

    return () => {
      cancel = true;
    };
  }, [page, query, status, reload]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const handleStatusChange = (nextStatus) => {
    setPage(1);
    setStatus(nextStatus);
  };

  const handleResetFilters = () => {
    setSearch("");
    setQuery("");
    setStatus("");
    setPage(1);
  };

  const openForm = async (invoice = null) => {
    try {
      const result = await getPurchaseOrdersRequest({
        page: 1,
        limit: 100,
      });
      setPos(
        result.data.filter((po) => po.status !== "DRAFT"),
      );
      setForm(invoice || {});
    } catch {
      setError("Daftar purchase order gagal dimuat.");
    }
  };

  const openDetail = async (id) => {
    try {
      setDetail(await getSupplierInvoiceRequest(id));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Detail tagihan gagal dimuat.",
      );
    }
  };

  const openFile = async (item) => {
    const blob = await openSupplierInvoiceAttachmentRequest(
      detail.id,
      item.id,
    );
    window.open(
      URL.createObjectURL(blob),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const removeFile = async (item) => {
    await deleteSupplierInvoiceAttachmentRequest(
      detail.id,
      item.id,
    );
    setDetail(await getSupplierInvoiceRequest(detail.id));
  };

  return (
    <div className="supplier-invoices-page">
      <section className="page-heading">
        <div>
          <p>Finance</p>
          <h2>Tagihan Supplier</h2>
          <span>
            Kelola invoice pembelian, jatuh tempo,
            pembayaran, dan dokumen supplier.
          </span>
        </div>

        <div className="page-heading-actions">
          {canEdit && (
            <button
              type="button"
              className="primary-action"
              onClick={() => openForm()}
            >
              <Plus aria-hidden="true" />
              <span>Tambah tagihan</span>
            </button>
          )}

          <button
            type="button"
            className="secondary-action"
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" />
            Muat ulang
          </button>
        </div>
      </section>

      {error && (
        <div className="data-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <section className="data-panel">
        <form
          className="data-filters supplier-invoice-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={search}
              aria-label="Cari tagihan supplier"
              placeholder="Cari invoice, PO, atau supplier"
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
            <button type="submit">Cari</button>
          </div>

          <StatusFilter
            value={status}
            options={statusOptions}
            ariaLabel="Filter status tagihan supplier"
            onChange={handleStatusChange}
          />

          {hasActiveFilters && (
            <button
              type="button"
              className="reset-filter"
              onClick={handleResetFilters}
            >
              <X aria-hidden="true" />
              Reset
            </button>
          )}
        </form>

        <div className="table-summary">
          <p>
            Menampilkan <strong>{rows.length}</strong> dari{" "}
            <strong>{pagination.total}</strong> tagihan
          </p>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table supplier-invoice-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Supplier / PO</th>
                <th>Tanggal</th>
                <th>Total</th>
                <th>Sisa</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-message">
                    <RefreshCw
                      className="is-spinning"
                      aria-hidden="true"
                    />
                    Memuat tagihan...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="table-message"
                    aria-live="polite"
                  >
                    Belum ada tagihan supplier yang sesuai.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Invoice">
                      <strong>{row.invoice_number}</strong>
                      <small>
                        {row.attachment_count} lampiran
                      </small>
                    </td>
                    <td data-label="Supplier / PO">
                      <strong>{row.supplier_name}</strong>
                      <small>{row.po_number}</small>
                    </td>
                    <td data-label="Tanggal">
                      <span>{formatDate(row.invoice_date)}</span>
                      <small>
                        Jatuh tempo {formatDate(row.due_date)}
                      </small>
                    </td>
                    <td data-label="Total">
                      {formatCurrency(row.total_amount)}
                    </td>
                    <td data-label="Sisa">
                      {formatCurrency(row.outstanding_amount)}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`supplier-invoice-status is-${row.effective_status.toLowerCase()}`}
                      >
                        {statusLabels[row.effective_status]}
                      </span>
                    </td>
                    <td data-label="Aksi">
                      <div className="supplier-invoice-actions">
                        <button
                          type="button"
                          onClick={() => openDetail(row.id)}
                        >
                          <Eye aria-hidden="true" />
                          Detail
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openForm(row)}
                          >
                            <Pencil aria-hidden="true" />
                            Edit
                          </button>
                        )}
                      </div>
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
          onPageChange={setPage}
        />
      </section>

      {form && (
        <InvoiceForm
          invoice={form.id ? form : null}
          purchaseOrders={pos}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setReload((value) => value + 1);
          }}
        />
      )}

      {detail && (
        <div className="supplier-invoice-backdrop">
          <section className="supplier-invoice-detail">
            <header>
              <div>
                <span>TAGIHAN SUPPLIER</span>
                <h2>{detail.invoice_number}</h2>
                <p>
                  {detail.supplier_name} · {detail.po_number}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup detail tagihan supplier"
                onClick={() => setDetail(null)}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="supplier-invoice-detail-body">
              <div className="supplier-invoice-summary-grid">
                <article>
                  <span>Total</span>
                  <strong>
                    {formatCurrency(detail.total_amount)}
                  </strong>
                </article>
                <article>
                  <span>Sudah dibayar</span>
                  <strong>
                    {formatCurrency(detail.paid_amount)}
                  </strong>
                </article>
                <article>
                  <span>Sisa</span>
                  <strong>
                    {formatCurrency(detail.outstanding_amount)}
                  </strong>
                </article>
              </div>

              <section>
                <h3>Lampiran invoice</h3>
                {detail.attachments.length ? (
                  detail.attachments.map((item) => (
                    <div
                      className="supplier-invoice-file"
                      key={item.id}
                    >
                      <FileText aria-hidden="true" />
                      <span>{item.original_name}</span>
                      <button
                        type="button"
                        onClick={() => openFile(item)}
                      >
                        <Eye aria-hidden="true" />
                        Preview
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="is-delete"
                          onClick={() => removeFile(item)}
                        >
                          <Trash2 aria-hidden="true" />
                          Hapus
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p>Belum ada lampiran.</p>
                )}
              </section>

              <section>
                <h3>Riwayat pembayaran</h3>
                {detail.payments.length ? (
                  detail.payments.map((item) => (
                    <div
                      className="supplier-invoice-payment"
                      key={item.id}
                    >
                      <span>
                        {item.payment_number} ·{" "}
                        {formatDate(item.payment_date)}
                      </span>
                      <strong>{formatCurrency(item.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <p>Belum ada pembayaran yang dikaitkan.</p>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default SupplierInvoicesPage;
