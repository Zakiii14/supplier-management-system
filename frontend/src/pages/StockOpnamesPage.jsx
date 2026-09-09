import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  cancelStockOpnameRequest,
  createStockOpnameRequest,
  decideStockOpnameRequest,
  getStockOpnameByIdRequest,
  getStockOpnamesRequest,
  submitStockOpnameRequest,
} from "../api/stockOpnames";
import { getActiveProductsRequest } from "../api/products";
import ApprovalActionDialog from "../components/approvals/ApprovalActionDialog";
import ApprovalHistory from "../components/approvals/ApprovalHistory";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import StatusFilter from "../components/filters/StatusFilter";
import CodeNumberField from "../components/forms/CodeNumberField";
import FormDatePicker from "../components/forms/FormDatePicker";
import FormSelect from "../components/forms/FormSelect";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useCodeNumberSetting from "../hooks/useCodeNumberSetting";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/stock-opnames.css";
import { formatDate, formatNumber } from "../utils/formatters";

const PAGE_LIMIT = 10;
const today = new Date().toISOString().slice(0, 10);
const statusOptions = [
  { value: "", label: "Semua status" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Menunggu persetujuan" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "CANCELLED", label: "Dibatalkan" },
];
const statusLabels = Object.fromEntries(statusOptions.slice(1).map((item) => [item.value, item.label]));
let rowSequence = 0;
const makeRow = () => ({ key: `stock-row-${Date.now()}-${rowSequence += 1}`, product_id: "", counted_quantity: "", notes: "" });

const StockOpnameForm = ({ products, busy, error, onClose, onSubmit }) => {
  const { setting, isLoading, errorMessage } = useCodeNumberSetting("STOCK_OPNAME");
  const [opnameNumber, setOpnameNumber] = useState("");
  const [opnameDate, setOpnameDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([makeRow()]);
  const options = products.map((product) => ({ value: product.id, code: product.sku, label: `${product.product_name} · stok ${formatNumber(product.current_stock)} ${product.unit}`, searchText: `${product.sku} ${product.product_name}` }));
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const updateItem = (key, field, value) => setItems((current) => current.map((item) => {
    if (item.key !== key) return item;
    if (field === "product_id") {
      const product = productMap.get(value);
      return { ...item, product_id: value, counted_quantity: product ? String(Number(product.current_stock)) : "" };
    }
    return { ...item, [field]: value };
  }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ opname_number: opnameNumber, opname_date: opnameDate, notes, items: items.map(({ product_id, counted_quantity, notes: itemNotes }) => ({ product_id, counted_quantity: Number(counted_quantity), notes: itemNotes })) });
  };

  return (
    <div className="stock-opname-backdrop" role="presentation">
      <section className="stock-opname-modal" role="dialog" aria-modal="true" aria-labelledby="stock-opname-form-title">
        <header>
          <div><span>INVENTORY CONTROL</span><h2 id="stock-opname-form-title">Tambah stock opname</h2></div>
          <button type="button" aria-label="Tutup" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="stock-opname-form-body">
            <CodeNumberField label="Nomor stock opname" name="opname_number" value={opnameNumber} placeholder="Contoh: SOF-2026-0001" maxLength={40} setting={setting} isLoading={isLoading} errorMessage={errorMessage} disabled={busy} onChange={(event) => setOpnameNumber(event.target.value)} className="stock-opname-field" />
            <FormDatePicker label="Tanggal penghitungan" value={opnameDate} disabled={busy} onChange={setOpnameDate} />
            <label className="stock-opname-field is-full"><span>Catatan</span><textarea rows={3} maxLength={1000} value={notes} placeholder="Contoh: Stock opname rutin akhir bulan" disabled={busy} onChange={(event) => setNotes(event.target.value)} /></label>

            <section className="stock-opname-items is-full">
              <div className="stock-opname-items-heading"><div><h3>Hasil penghitungan</h3><p>Masukkan jumlah barang yang benar-benar ditemukan di gudang.</p></div><button type="button" disabled={busy || items.length >= 100} onClick={() => setItems((current) => [...current, makeRow()])}><Plus aria-hidden="true" /> Tambah produk</button></div>
              {items.map((item, index) => {
                const product = productMap.get(item.product_id);
                const variance = product && item.counted_quantity !== "" ? Number(item.counted_quantity) - Number(product.current_stock) : null;
                return (
                  <article key={item.key} className="stock-opname-item-row">
                    <span className="stock-opname-item-number">{index + 1}</span>
                    <FormSelect label="Produk" value={item.product_id} options={options} placeholder="Pilih produk" searchPlaceholder="Cari SKU atau nama produk" disabled={busy} onChange={(value) => updateItem(item.key, "product_id", value)} />
                    <label><span>Stok sistem</span><input value={product ? `${formatNumber(product.current_stock)} ${product.unit}` : "-"} readOnly /></label>
                    <label><span>Stok fisik</span><input type="number" min="0" step="0.001" required value={item.counted_quantity} disabled={busy || !product} onChange={(event) => updateItem(item.key, "counted_quantity", event.target.value)} /></label>
                    <div className={`stock-opname-variance ${variance > 0 ? "is-positive" : variance < 0 ? "is-negative" : ""}`}><span>Selisih</span><strong>{variance === null ? "-" : `${variance > 0 ? "+" : ""}${formatNumber(variance)}`}</strong></div>
                    <label className="stock-opname-item-notes"><span>Keterangan</span><input maxLength={300} value={item.notes} placeholder="Opsional" disabled={busy} onChange={(event) => updateItem(item.key, "notes", event.target.value)} /></label>
                    <button type="button" className="stock-opname-remove" aria-label={`Hapus produk ${index + 1}`} disabled={busy || items.length === 1} onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}><Trash2 aria-hidden="true" /></button>
                  </article>
                );
              })}
            </section>
            {error && <div className="stock-opname-form-error is-full" role="alert"><AlertTriangle aria-hidden="true" />{error}</div>}
          </div>
          <footer><button type="button" className="secondary-action" disabled={busy} onClick={onClose}>Batal</button><button type="submit" className="primary-action" disabled={busy || isLoading}><Save aria-hidden="true" />{busy ? "Menyimpan..." : "Simpan draft"}</button></footer>
        </form>
      </section>
    </div>
  );
};

const StockOpnameDetail = ({ detail, user, busy, error, onClose, onAction }) => {
  const canSubmit = ["ADMIN", "WAREHOUSE"].includes(user?.role) && detail.status === "DRAFT";
  const canDecide = ["ADMIN", "MANAGER"].includes(user?.role) && detail.status === "PENDING" && detail.submitted_by !== user?.id;
  const canCancel = ["ADMIN", "WAREHOUSE"].includes(user?.role) && ["DRAFT", "REJECTED"].includes(detail.status);
  return (
    <div className="stock-opname-backdrop" role="presentation">
      <section className="stock-opname-modal stock-opname-detail" role="dialog" aria-modal="true" aria-labelledby="stock-opname-detail-title">
        <header><div><span>STOCK OPNAME</span><h2 id="stock-opname-detail-title">{detail.opname_number}</h2><p>{formatDate(detail.opname_date)} · {detail.created_by_name || "Pengguna tidak tersedia"}</p></div><button type="button" aria-label="Tutup" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button></header>
        <div className="stock-opname-detail-body">
          <div className="stock-opname-summary">
            <article><span>Status</span><strong className={`stock-opname-status is-${detail.status.toLowerCase()}`}>{statusLabels[detail.status]}</strong></article>
            <article><span>Produk dihitung</span><strong>{formatNumber(detail.item_count)} produk</strong></article>
            <article><span>Total selisih absolut</span><strong>{formatNumber(detail.total_variance)} unit</strong></article>
          </div>
          {detail.notes && <div className="stock-opname-notes"><span>Catatan penghitungan</span><p>{detail.notes}</p></div>}
          <section><h3>Rincian penghitungan</h3><div className="stock-opname-detail-table"><table className="data-table"><thead><tr><th>Produk</th><th>Stok sistem</th><th>Stok fisik</th><th>Selisih</th><th>Keterangan</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td data-label="Produk"><strong>{item.product_name}</strong><small>{item.sku}</small></td><td data-label="Stok sistem">{formatNumber(item.system_quantity)} {item.unit}</td><td data-label="Stok fisik">{formatNumber(item.counted_quantity)} {item.unit}</td><td data-label="Selisih"><strong className={`stock-opname-difference ${Number(item.variance) > 0 ? "is-positive" : Number(item.variance) < 0 ? "is-negative" : ""}`}>{Number(item.variance) > 0 ? "+" : ""}{formatNumber(item.variance)}</strong></td><td data-label="Keterangan">{item.notes || "-"}</td></tr>)}</tbody></table></div></section>
          <ApprovalHistory approvalStatus={detail.status} rejectionReason={detail.rejection_reason} history={detail.approval_history} />
          {detail.status === "PENDING" && detail.submitted_by === user?.id && <div className="stock-opname-info">Stock opname sedang menunggu keputusan pengguna lain yang berwenang.</div>}
          {error && <div className="stock-opname-form-error" role="alert"><AlertTriangle aria-hidden="true" />{error}</div>}
        </div>
        {(canSubmit || canDecide || canCancel) && <footer>{canCancel && <button type="button" className="stock-opname-danger-action" disabled={busy} onClick={() => onAction("CANCEL")}><XCircle aria-hidden="true" /> Batalkan</button>}{canDecide && <><button type="button" className="stock-opname-reject-action" disabled={busy} onClick={() => onAction("REJECT")}><XCircle aria-hidden="true" /> Tolak</button><button type="button" className="primary-action" disabled={busy} onClick={() => onAction("APPROVE")}><CheckCircle2 aria-hidden="true" /> Setujui</button></>}{canSubmit && <button type="button" className="primary-action" disabled={busy} onClick={() => onAction("SUBMIT")}><Send aria-hidden="true" /> Ajukan</button>}</footer>}
      </section>
    </div>
  );
};

const StockOpnamesPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();
  const canCreate = ["ADMIN", "WAREHOUSE"].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, total_pages: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [approvalAction, setApprovalAction] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError("");
        const response = await getStockOpnamesRequest({ page, limit: PAGE_LIMIT, ...(search && { search }), ...(status && { status }), ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }) });
        if (!cancelled) { setRows(response.data); setPagination(response.pagination); }
      } catch (requestError) {
        if (!cancelled) { setRows([]); setError(requestError.response?.data?.message || "Stock opname gagal dimuat."); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [page, search, status, dateFrom, dateTo, reloadKey]);

  const refreshDetail = async (id) => { const next = await getStockOpnameByIdRequest(id); setDetail(next); return next; };
  const openCreate = async () => {
    try { setBusy(true); setActionError(""); setProducts(await getActiveProductsRequest()); setFormOpen(true); }
    catch (requestError) { setActionError(requestError.response?.data?.message || "Daftar produk gagal dimuat."); }
    finally { setBusy(false); }
  };
  const createOpname = async (payload) => {
    try { setBusy(true); setActionError(""); const created = await createStockOpnameRequest(payload); setFormOpen(false); setReloadKey((value) => value + 1); setDetail(created); }
    catch (requestError) { setActionError(requestError.response?.data?.message || "Stock opname gagal disimpan."); }
    finally { setBusy(false); }
  };
  const runAction = async ({ action, reason = "" }) => {
    if (!detail) return;
    try {
      setBusy(true); setActionError("");
      if (action === "SUBMIT") await submitStockOpnameRequest(detail.id);
      if (action === "APPROVE") await decideStockOpnameRequest(detail.id, "APPROVED");
      if (action === "REJECT") await decideStockOpnameRequest(detail.id, "REJECTED", reason);
      if (action === "CANCEL") await cancelStockOpnameRequest(detail.id);
      setApprovalAction(""); await refreshDetail(detail.id); setReloadKey((value) => value + 1);
    } catch (requestError) { setActionError(requestError.response?.data?.message || "Tindakan gagal diproses."); }
    finally { setBusy(false); }
  };
  const resetFilters = () => { setSearchInput(""); setSearch(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); };
  const hasFilters = search || status || dateFrom || dateTo;

  return (
    <div className="stock-opnames-page">
      <section className="page-heading"><div><p>Purchasing &amp; Inventory</p><h2>Stock Opname</h2><span>Cocokkan stok sistem dengan hasil penghitungan fisik secara terkontrol.</span></div><div className="page-heading-actions">{canCreate && <button type="button" className="primary-action" disabled={busy} onClick={openCreate}><Plus aria-hidden="true" /> Tambah stock opname</button>}<button type="button" className="secondary-action" disabled={loading} onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className={loading ? "is-spinning" : ""} aria-hidden="true" /> Muat ulang</button></div></section>
      {actionError && !formOpen && !detail && <div className="data-error" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Tindakan tidak dapat diproses</strong><span>{actionError}</span></div></div>}
      <section className="data-panel">
        <form ref={filtersRef} className="data-filters stock-opname-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
          <div className="search-control"><ClipboardList aria-hidden="true" /><input type="search" value={searchInput} placeholder="Cari nomor atau pembuat stock opname" aria-label="Cari stock opname" onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Cari</button></div>
          <StatusFilter value={status} options={statusOptions} ariaLabel="Filter status stock opname" onChange={(value) => { setStatus(value); setPage(1); }} />
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} disabled={loading} onDateFromChange={(value) => { setDateFrom(value); setPage(1); }} onDateToChange={(value) => { setDateTo(value); setPage(1); }} />
          {hasFilters && <button type="button" className="reset-filter" onClick={resetFilters}><X aria-hidden="true" /> Reset</button>}
        </form>
        {error && <div className="data-error" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Data tidak dapat ditampilkan</strong><span>{error}</span></div></div>}
        <div className="table-summary"><p>Menampilkan <strong>{rows.length}</strong> dari <strong>{formatNumber(pagination.total)}</strong> stock opname</p></div>
        <div className="data-table-wrapper"><table className="data-table stock-opname-table"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Pembuat</th><th>Produk</th><th>Item berselisih</th><th>Total selisih</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="table-message"><RefreshCw className="is-spinning" aria-hidden="true" /> Memuat stock opname...</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="table-message"><ClipboardList aria-hidden="true" /> Tidak ada stock opname yang sesuai.</td></tr> : rows.map((row) => <tr key={row.id}><td data-label="Nomor"><strong className="stock-opname-number">{row.opname_number}</strong></td><td data-label="Tanggal">{formatDate(row.opname_date)}</td><td data-label="Pembuat">{row.created_by_name || "-"}</td><td data-label="Produk">{formatNumber(row.item_count)}</td><td data-label="Item berselisih">{formatNumber(row.variance_item_count)}</td><td data-label="Total selisih">{formatNumber(row.total_variance)}</td><td data-label="Status"><span className={`stock-opname-status is-${row.status.toLowerCase()}`}>{statusLabels[row.status]}</span></td><td data-label="Aksi" className="table-action-cell"><button type="button" className="table-view-action" disabled={busy} onClick={async () => { try { setBusy(true); setActionError(""); await refreshDetail(row.id); } catch (requestError) { setActionError(requestError.response?.data?.message || "Detail gagal dimuat."); } finally { setBusy(false); } }}><Eye aria-hidden="true" /> Detail</button></td></tr>)}</tbody></table></div>
        <PaginationBar page={page} totalPages={Math.max(pagination.total_pages, 1)} isLoading={loading} onPageChange={setPage} />
      </section>
      {formOpen && <StockOpnameForm products={products} busy={busy} error={actionError} onClose={() => { if (!busy) { setFormOpen(false); setActionError(""); } }} onSubmit={createOpname} />}
      {detail && <StockOpnameDetail detail={detail} user={user} busy={busy} error={actionError} onClose={() => { if (!busy) { setDetail(null); setActionError(""); } }} onAction={setApprovalAction} />}
      <ApprovalActionDialog isOpen={Boolean(approvalAction)} action={approvalAction} transactionLabel="Stock opname" transactionNumber={detail?.opname_number} isSubmitting={busy} requestError={actionError} onCancel={() => { if (!busy) { setApprovalAction(""); setActionError(""); } }} onConfirm={runAction} />
    </div>
  );
};

export default StockOpnamesPage;
