import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  HandCoins,
  PackageX,
  Plus,
  RefreshCw,
  Save,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  cancelSalesReturnRequest,
  createSalesReturnRequest,
  createSalesReturnSettlementRequest,
  decideSalesReturnRequest,
  getSalesReturnByIdRequest,
  getSalesReturnsRequest,
  getSalesReturnSettlementInvoicesRequest,
  getReturnableDeliveryItemsRequest,
  getReturnableDeliveriesRequest,
  submitSalesReturnRequest,
} from "../api/salesReturns";
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
import useModalDismiss from "../hooks/useModalDismiss";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/purchase-returns.css";
import { formatCurrency, formatDate, formatNumber } from "../utils/formatters";

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
const reasonOptions = [
  { value: "DAMAGED", label: "Barang rusak" },
  { value: "WRONG_ITEM", label: "Barang tidak sesuai" },
  { value: "QUALITY_ISSUE", label: "Masalah kualitas" },
  { value: "CUSTOMER_REQUEST", label: "Permintaan customer" },
  { value: "OTHER", label: "Alasan lainnya" },
];
const reasonLabels = Object.fromEntries(reasonOptions.map((item) => [item.value, item.label]));
const conditionOptions = [
  { value: "SALEABLE", label: "Layak dijual kembali" },
  { value: "DAMAGED", label: "Rusak" },
  { value: "QUARANTINE", label: "Perlu pemeriksaan/karantina" },
];
const conditionLabels = Object.fromEntries(conditionOptions.map((item) => [item.value, item.label]));
const conditionStockLabels = {
  SALEABLE: "Masuk stok tersedia",
  QUARANTINE: "Masuk stok karantina",
  DAMAGED: "Masuk stok rusak",
};
const settlementTypeOptions = [
  { value: "INVOICE_DEDUCTION", label: "Potong tagihan asal" },
  { value: "CUSTOMER_CREDIT", label: "Gunakan kredit ke tagihan lain" },
  { value: "REFUND", label: "Pengembalian dana ke customer" },
  { value: "REPLACEMENT", label: "Penggantian barang ke customer" },
];
const settlementTypeLabels = Object.fromEntries(settlementTypeOptions.map((item) => [item.value, item.label]));
const settlementStatusLabels = { UNSETTLED: "Belum diselesaikan", PARTIAL: "Diselesaikan sebagian", SETTLED: "Selesai" };

const SalesReturnForm = ({ busy, error, onClose, onSubmit }) => {
  useModalDismiss(true, onClose, busy);
  const { setting, isLoading: numberLoading, errorMessage } = useCodeNumberSetting("SALES_RETURN");
  const [returnNumber, setReturnNumber] = useState("");
  const [returnDate, setReturnDate] = useState(today);
  const [reason, setReason] = useState("DAMAGED");
  const [notes, setNotes] = useState("");
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryId, setDeliveryId] = useState("");
  const [deliveryDetail, setDeliveryDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingSource, setLoadingSource] = useState(true);
  const [sourceError, setSourceError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getReturnableDeliveriesRequest()
      .then((data) => { if (!cancelled) setDeliveries(data); })
      .catch((requestError) => { if (!cancelled) setSourceError(requestError.response?.data?.message || "Daftar delivery gagal dimuat."); })
      .finally(() => { if (!cancelled) setLoadingSource(false); });
    return () => { cancelled = true; };
  }, []);

  const deliveryOptions = deliveries.map((delivery) => ({
    value: delivery.id,
    code: delivery.delivery_number,
    label: `${delivery.customer_name} · ${delivery.so_number}`,
    searchText: `${delivery.delivery_number} ${delivery.so_number} ${delivery.customer_name}`,
  }));

  const selectDelivery = async (value) => {
    setDeliveryId(value); setDeliveryDetail(null); setItems([]); setSourceError("");
    if (!value) return;
    try {
      setLoadingSource(true);
      const detail = await getReturnableDeliveryItemsRequest(value);
      setDeliveryDetail(detail);
      setItems(detail.items.map((item) => ({ ...item, quantity: "", item_condition: "QUARANTINE", notes: "" })));
    } catch (requestError) {
      setSourceError(requestError.response?.data?.message || "Rincian delivery gagal dimuat.");
    } finally { setLoadingSource(false); }
  };

  const updateItem = (productId, field, value) => setItems((current) => current.map((item) => (
    item.product_id === productId ? { ...item, [field]: value } : item
  )));

  const selectedItems = useMemo(() => items.filter((item) => Number(item.quantity) > 0), [items]);
  const totalAmount = selectedItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  const submitForm = (event) => {
    event.preventDefault();
    onSubmit({
      return_number: returnNumber,
      delivery_id: deliveryId,
      return_date: returnDate,
      reason,
      notes,
      items: selectedItems.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        item_condition: item.item_condition,
        notes: item.notes,
      })),
    });
  };

  return (
    <div className="purchase-return-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="purchase-return-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-return-form-title">
        <header>
          <div><span>SALES &amp; DELIVERY</span><h2 id="purchase-return-form-title">Tambah retur penjualan</h2></div>
          <button type="button" aria-label="Tutup" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <form onSubmit={submitForm}>
          <div className="purchase-return-form-body">
            <CodeNumberField label="Nomor retur" name="return_number" value={returnNumber} placeholder="Contoh: SRT-2026-0001" maxLength={40} setting={setting} isLoading={numberLoading} errorMessage={errorMessage} disabled={busy} onChange={(event) => setReturnNumber(event.target.value)} className="purchase-return-field" />
            <FormDatePicker label="Tanggal retur" value={returnDate} disabled={busy} onChange={setReturnDate} />
            <div className="purchase-return-field is-full"><FormSelect label="Delivery" value={deliveryId} options={deliveryOptions} placeholder={loadingSource ? "Memuat delivery..." : "Pilih delivery"} searchPlaceholder="Cari nomor delivery, SO, atau customer" disabled={busy || loadingSource} onChange={selectDelivery} /></div>
            <FormSelect label="Alasan retur" value={reason} options={reasonOptions} disabled={busy} onChange={setReason} />
            <label className="purchase-return-field"><span>Catatan umum</span><textarea rows={3} maxLength={1000} value={notes} placeholder="Jelaskan alasan atau instruksi pengembalian" disabled={busy} onChange={(event) => setNotes(event.target.value)} /></label>

            {deliveryDetail && <div className="purchase-return-source is-full"><PackageX aria-hidden="true" /><div><strong>{deliveryDetail.delivery_number}</strong><span>{deliveryDetail.customer_name} · {deliveryDetail.so_number} · {formatDate(deliveryDetail.delivery_date)}</span></div></div>}
            {deliveryId && !loadingSource && <section className="purchase-return-items is-full">
              <div className="purchase-return-items-heading"><div><h3>Barang yang dikembalikan</h3><p>Isi jumlah hanya pada produk yang akan diretur.</p></div><strong>{selectedItems.length} produk · {formatCurrency(totalAmount)}</strong></div>
              {items.length === 0 ? <div className="purchase-return-empty">Tidak ada barang yang masih dapat diretur dari delivery ini.</div> : items.map((item) => <article key={item.product_id} className="purchase-return-item-row">
                <div className="purchase-return-product"><strong>{item.product_name}</strong><span>{item.sku} · tersedia {formatNumber(item.returnable_quantity)} {item.unit}</span></div>
                <label><span>Jumlah retur</span><input type="number" min="0" max={Number(item.returnable_quantity)} step="0.001" value={item.quantity} placeholder="0" disabled={busy} onChange={(event) => updateItem(item.product_id, "quantity", event.target.value)} /></label>
                <FormSelect label="Kondisi" value={item.item_condition} options={conditionOptions} disabled={busy || !(Number(item.quantity) > 0)} onChange={(value) => updateItem(item.product_id, "item_condition", value)} />
                <label><span>Keterangan</span><input maxLength={300} value={item.notes} placeholder="Opsional" disabled={busy || !(Number(item.quantity) > 0)} onChange={(event) => updateItem(item.product_id, "notes", event.target.value)} /></label>
              </article>)}
            </section>}
            {(sourceError || error) && <div className="purchase-return-form-error is-full" role="alert"><AlertTriangle aria-hidden="true" />{sourceError || error}</div>}
          </div>
          <footer><button type="button" className="secondary-action" disabled={busy} onClick={onClose}>Batal</button><button type="submit" className="primary-action" disabled={busy || numberLoading || loadingSource || !deliveryId || selectedItems.length === 0}><Save aria-hidden="true" />{busy ? "Menyimpan..." : "Simpan draft"}</button></footer>
        </form>
      </section>
    </div>
  );
};

const SalesReturnSettlementForm = ({ detail, busy, error, onClose, onSubmit }) => {
  useModalDismiss(true, onClose, busy);
  const [type, setType] = useState("INVOICE_DEDUCTION");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(String(Number(detail.settlement_remaining)));
  const [invoiceId, setInvoiceId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadError, setLoadError] = useState("");
  const needsInvoice = ["INVOICE_DEDUCTION", "CUSTOMER_CREDIT"].includes(type);
  const availableInvoices = type === "INVOICE_DEDUCTION"
    ? invoices.filter((invoice) => invoice.scope === "SAME_SO")
    : invoices.filter((invoice) => invoice.scope === "SAME_CUSTOMER");
  const invoiceOptions = availableInvoices.map((invoice) => ({
    value: invoice.id,
    code: invoice.invoice_number,
    label: `${invoice.so_number} · sisa ${formatCurrency(invoice.outstanding_amount)}`,
    searchText: `${invoice.invoice_number} ${invoice.so_number}`,
  }));

  useEffect(() => {
    let cancelled = false;
    getSalesReturnSettlementInvoicesRequest(detail.id)
      .then((data) => {
        if (cancelled) return;
        setInvoices(data);
        const originalInvoices = data.filter((invoice) => invoice.scope === "SAME_SO");
        if (originalInvoices.length === 1) {
          setInvoiceId(originalInvoices[0].id);
          setAmount(String(Math.min(Number(detail.settlement_remaining), Number(originalInvoices[0].outstanding_amount))));
        }
      })
      .catch((requestError) => { if (!cancelled) setLoadError(requestError.response?.data?.message || "Daftar tagihan gagal dimuat."); })
      .finally(() => { if (!cancelled) setLoadingInvoices(false); });
    return () => { cancelled = true; };
  }, [detail.id, detail.settlement_remaining]);

  const selectedInvoice = availableInvoices.find((invoice) => invoice.id === invoiceId);
  const maximumAmount = selectedInvoice
    ? Math.min(Number(detail.settlement_remaining), Number(selectedInvoice.outstanding_amount))
    : Number(detail.settlement_remaining);

  const changeType = (value) => {
    setType(value);
    const candidates = value === "INVOICE_DEDUCTION"
      ? invoices.filter((invoice) => invoice.scope === "SAME_SO")
      : value === "CUSTOMER_CREDIT"
        ? invoices.filter((invoice) => invoice.scope === "SAME_CUSTOMER")
        : [];
    const selected = candidates.length === 1 ? candidates[0] : null;
    setInvoiceId(selected?.id || "");
    setAmount(String(selected
      ? Math.min(Number(detail.settlement_remaining), Number(selected.outstanding_amount))
      : Number(detail.settlement_remaining)));
  };
  const submit = (event) => {
    event.preventDefault();
    onSubmit({ settlement_type: type, settlement_date: date, amount: Number(amount), invoice_id: needsInvoice ? invoiceId : null, reference_number: referenceNumber, notes });
  };

  return <div className="purchase-return-backdrop is-nested" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="purchase-return-modal purchase-return-settlement-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-return-settlement-title">
      <header><div><span>PENYELESAIAN RETUR</span><h2 id="purchase-return-settlement-title">Catat penyelesaian {detail.return_number}</h2><p>Sisa yang harus diselesaikan: {formatCurrency(detail.settlement_remaining)}</p></div><button type="button" aria-label="Tutup" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button></header>
      <form onSubmit={submit}>
        <div className="purchase-return-form-body">
          <FormSelect label="Metode penyelesaian" value={type} options={settlementTypeOptions} disabled={busy} onChange={changeType} />
          <FormDatePicker label="Tanggal penyelesaian" value={date} disabled={busy} onChange={setDate} />
          {needsInvoice && <div className="purchase-return-field is-full"><FormSelect label={type === "INVOICE_DEDUCTION" ? "Invoice asal yang akan dipotong" : "Invoice lain yang menerima kredit"} value={invoiceId} options={invoiceOptions} placeholder={loadingInvoices ? "Memuat invoice..." : "Pilih invoice customer"} searchPlaceholder="Cari invoice atau SO" disabled={busy || loadingInvoices} onChange={(value) => { const selected = availableInvoices.find((invoice) => invoice.id === value); setInvoiceId(value); if (selected) setAmount(String(Math.min(Number(detail.settlement_remaining), Number(selected.outstanding_amount)))); }} />{!loadingInvoices && invoiceOptions.length === 0 && <small>{type === "INVOICE_DEDUCTION" ? "Invoice asal tidak memiliki sisa yang dapat dipotong. Jika sudah lunas, gunakan refund ke customer." : "Tidak ada invoice lain yang masih memiliki sisa untuk customer ini."}</small>}</div>}
          <div className="purchase-return-settlement-help is-full">{type === "INVOICE_DEDUCTION" && "Mengurangi sisa invoice pada sales order asal retur."}{type === "CUSTOMER_CREDIT" && "Memakai nilai retur sebagai potongan untuk invoice lain milik customer yang sama."}{type === "REFUND" && "Mencatat dana yang dikembalikan perusahaan kepada customer setelah invoice dibayar."}{type === "REPLACEMENT" && "Mencatat bahwa retur diselesaikan dengan pengiriman barang pengganti ke customer."}</div>
          <label className="purchase-return-field"><span>Nilai penyelesaian</span><input type="number" min="0.01" max={maximumAmount} step="0.01" value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} /><small>Dapat diisi sebagian; maksimal {formatCurrency(maximumAmount)}.</small></label>
          <label className="purchase-return-field"><span>Nomor referensi</span><input maxLength={100} value={referenceNumber} placeholder="Opsional: nomor memo/refund/penggantian" disabled={busy} onChange={(event) => setReferenceNumber(event.target.value)} /></label>
          <label className="purchase-return-field is-full"><span>Catatan</span><textarea rows={3} maxLength={1000} value={notes} placeholder="Keterangan penyelesaian retur" disabled={busy} onChange={(event) => setNotes(event.target.value)} /></label>
          {(loadError || error) && <div className="purchase-return-form-error is-full" role="alert"><AlertTriangle aria-hidden="true" />{loadError || error}</div>}
        </div>
        <footer><button type="button" className="secondary-action" disabled={busy} onClick={onClose}>Batal</button><button type="submit" className="primary-action" disabled={busy || loadingInvoices || Number(amount) <= 0 || Number(amount) > maximumAmount || (needsInvoice && !invoiceId)}><HandCoins aria-hidden="true" />{busy ? "Menyimpan..." : "Simpan penyelesaian"}</button></footer>
      </form>
    </section>
  </div>;
};

const SalesReturnDetail = ({ detail, user, busy, error, dismissDisabled, onClose, onAction, onSettle }) => {
  const canSubmit = ["ADMIN", "SALES", "WAREHOUSE"].includes(user?.role) && ["DRAFT", "REJECTED"].includes(detail.status);
  const canDecide = ["ADMIN", "MANAGER"].includes(user?.role) && detail.status === "PENDING" && detail.submitted_by !== user?.id;
  const canCancel = ["ADMIN", "SALES", "WAREHOUSE"].includes(user?.role) && ["DRAFT", "REJECTED"].includes(detail.status);
  const canSettle = ["ADMIN", "FINANCE"].includes(user?.role) && detail.status === "APPROVED" && Number(detail.settlement_remaining) > 0;
  const stockDistribution = detail.items.reduce((totals, item) => ({
    ...totals,
    [item.item_condition]: (totals[item.item_condition] || 0) + Number(item.quantity),
  }), { SALEABLE: 0, QUARANTINE: 0, DAMAGED: 0 });
  useModalDismiss(true, onClose, busy || dismissDisabled);
  return (
    <div className="purchase-return-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy && !dismissDisabled) onClose(); }}>
      <section className="purchase-return-modal purchase-return-detail" role="dialog" aria-modal="true" aria-labelledby="purchase-return-detail-title">
        <header><div><span>RETUR PENJUALAN</span><h2 id="purchase-return-detail-title">{detail.return_number}</h2><p>{formatDate(detail.return_date)} · {detail.customer_name}</p></div><button type="button" aria-label="Tutup" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button></header>
        <div className="purchase-return-detail-body">
          <div className="purchase-return-summary">
            <article><span>Status</span><strong className={`purchase-return-status is-${detail.status.toLowerCase()}`}>{statusLabels[detail.status]}</strong></article>
            <article><span>Delivery / SO</span><strong>{detail.delivery_number}</strong><small>{detail.so_number}</small></article>
            <article><span>Jumlah retur</span><strong>{formatNumber(detail.total_quantity)} unit</strong><small>{formatCurrency(detail.total_amount)}</small></article>
            <article><span>Penyelesaian customer</span><strong>{settlementStatusLabels[detail.settlement_status]}</strong><small>{formatCurrency(detail.settled_amount)} dari {formatCurrency(detail.total_amount)}</small></article>
          </div>
          <div className="purchase-return-notes"><span>Alasan retur</span><strong>{reasonLabels[detail.reason] || detail.reason}</strong>{detail.notes && <p>{detail.notes}</p>}</div>
          <section className="purchase-return-stock-impact"><div><h3>Dampak inventory</h3><p>Barang dialokasikan otomatis berdasarkan kondisi saat retur disetujui.</p></div><div className="purchase-return-stock-grid"><article><span>Stok tersedia</span><strong>{formatNumber(stockDistribution.SALEABLE)} unit</strong></article><article><span>Stok karantina</span><strong>{formatNumber(stockDistribution.QUARANTINE)} unit</strong></article><article><span>Stok rusak</span><strong>{formatNumber(stockDistribution.DAMAGED)} unit</strong></article></div></section>
          <section><h3>Rincian barang</h3><div className="purchase-return-detail-table"><table className="data-table"><thead><tr><th>Produk</th><th>Kondisi</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th><th>Keterangan</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td data-label="Produk"><strong>{item.product_name}</strong><small>{item.sku}</small></td><td data-label="Kondisi"><span className="purchase-return-condition">{conditionLabels[item.item_condition] || item.item_condition}<small>{conditionStockLabels[item.item_condition] || "Tidak mengubah stok tersedia"}</small></span></td><td data-label="Jumlah">{formatNumber(item.quantity)} {item.unit}</td><td data-label="Harga">{formatCurrency(item.unit_price)}</td><td data-label="Subtotal"><strong>{formatCurrency(item.subtotal)}</strong></td><td data-label="Keterangan">{item.notes || "-"}</td></tr>)}</tbody></table></div></section>
          <ApprovalHistory approvalStatus={detail.status} rejectionReason={detail.rejection_reason} history={detail.approval_history} />
          <section className="purchase-return-settlements"><h3>Riwayat penyelesaian customer</h3>{detail.settlements.length ? detail.settlements.map((item) => <article key={item.id}><div><strong>{settlementTypeLabels[item.settlement_type] || item.settlement_type}</strong><span>{formatDate(item.settlement_date)}{item.invoice_number ? ` · ${item.invoice_number}` : ""}{item.reference_number ? ` · ${item.reference_number}` : ""}</span></div><strong>{formatCurrency(item.amount)}</strong>{item.notes && <p>{item.notes}</p>}</article>) : <p>Belum ada penyelesaian finansial atau penggantian yang dicatat.</p>}</section>
          {detail.status === "PENDING" && detail.submitted_by === user?.id && <div className="purchase-return-info">Retur sedang menunggu keputusan pengguna lain yang berwenang.</div>}
          {error && <div className="purchase-return-form-error" role="alert"><AlertTriangle aria-hidden="true" />{error}</div>}
        </div>
        <footer className="modal-detail-footer">{canCancel && <button type="button" className="purchase-return-danger-action" disabled={busy} onClick={() => onAction("CANCEL")}><XCircle aria-hidden="true" /> Batalkan</button>}{canSettle && <button type="button" className="primary-action" disabled={busy} onClick={onSettle}><HandCoins aria-hidden="true" /> Catat penyelesaian</button>}{canDecide && <><button type="button" className="purchase-return-reject-action" disabled={busy} onClick={() => onAction("REJECT")}><XCircle aria-hidden="true" /> Tolak</button><button type="button" className="primary-action" disabled={busy} onClick={() => onAction("APPROVE")}><CheckCircle2 aria-hidden="true" /> Setujui</button></>}{canSubmit && <button type="button" className="primary-action" disabled={busy} onClick={() => onAction("SUBMIT")}><Send aria-hidden="true" /> Ajukan</button>}<button type="button" className="modal-detail-close-action" disabled={busy} onClick={onClose}>Tutup</button></footer>
      </section>
    </div>
  );
};

const SalesReturnsPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canCreate = ["ADMIN", "SALES", "WAREHOUSE"].includes(user?.role);
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
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [approvalAction, setApprovalAction] = useState("");
  const [settlementOpen, setSettlementOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError("");
        const response = await getSalesReturnsRequest({ page, limit: PAGE_LIMIT, ...(search && { search }), ...(status && { status }), ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }) });
        if (!cancelled) { setRows(response.data); setPagination(response.pagination); }
      } catch (requestError) {
        if (!cancelled) { setRows([]); setError(requestError.response?.data?.message || "Retur pembelian gagal dimuat."); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [page, search, status, dateFrom, dateTo, reloadKey]);

  const refreshDetail = async (id) => { const next = await getSalesReturnByIdRequest(id); setDetail(next); return next; };

  useEffect(() => {
    const targetId = location.state?.notificationTarget?.id;
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      try {
        setBusy(true); setActionError("");
        const next = await getSalesReturnByIdRequest(targetId);
        if (!cancelled) setDetail(next);
      } catch (requestError) {
        if (!cancelled) setActionError(requestError.response?.data?.message || "Detail retur dari notifikasi gagal dimuat.");
      } finally {
        if (!cancelled) {
          setBusy(false);
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname, location.state, navigate]);
  const createReturn = async (payload) => {
    try { setBusy(true); setActionError(""); const created = await createSalesReturnRequest(payload); setFormOpen(false); setReloadKey((value) => value + 1); setDetail(created); }
    catch (requestError) { setActionError(requestError.response?.data?.message || "Retur pembelian gagal disimpan."); }
    finally { setBusy(false); }
  };
  const runAction = async ({ action, reason = "" }) => {
    if (!detail) return;
    try {
      setBusy(true); setActionError("");
      if (action === "SUBMIT") await submitSalesReturnRequest(detail.id);
      if (action === "APPROVE") await decideSalesReturnRequest(detail.id, "APPROVED");
      if (action === "REJECT") await decideSalesReturnRequest(detail.id, "REJECTED", reason);
      if (action === "CANCEL") await cancelSalesReturnRequest(detail.id);
      setApprovalAction(""); await refreshDetail(detail.id); setReloadKey((value) => value + 1);
    } catch (requestError) { setActionError(requestError.response?.data?.message || "Tindakan gagal diproses."); }
    finally { setBusy(false); }
  };
  const createSettlement = async (payload) => {
    if (!detail) return;
    try {
      setBusy(true); setActionError("");
      await createSalesReturnSettlementRequest(detail.id, payload);
      setSettlementOpen(false); await refreshDetail(detail.id); setReloadKey((value) => value + 1);
    } catch (requestError) { setActionError(requestError.response?.data?.message || "Penyelesaian retur gagal disimpan."); }
    finally { setBusy(false); }
  };
  const resetFilters = () => { setSearchInput(""); setSearch(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); };
  const hasFilters = search || status || dateFrom || dateTo;

  return (
    <div className="purchase-returns-page">
      <section className="page-heading"><div><p>Sales &amp; Delivery</p><h2>Retur Penjualan</h2><span>Catat barang yang dikembalikan customer, kondisi stok, dan penyelesaiannya.</span></div><div className="page-heading-actions">{canCreate && <button type="button" className="primary-action" disabled={busy} onClick={() => { setActionError(""); setFormOpen(true); }}><Plus aria-hidden="true" /> <span>Tambah retur</span></button>}<button type="button" className="secondary-action" disabled={loading} onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className={loading ? "is-spinning" : ""} aria-hidden="true" /> Muat ulang</button></div></section>
      {actionError && !formOpen && !detail && <div className="data-error" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Tindakan tidak dapat diproses</strong><span>{actionError}</span></div></div>}
      <section className="data-panel">
        <form ref={filtersRef} className="data-filters purchase-return-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
          <div className="search-control"><PackageX aria-hidden="true" /><input type="search" value={searchInput} placeholder="Cari nomor retur, delivery, SO, atau customer" aria-label="Cari retur penjualan" onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Cari</button></div>
          <StatusFilter value={status} options={statusOptions} ariaLabel="Filter status retur penjualan" onChange={(value) => { setStatus(value); setPage(1); }} />
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} disabled={loading} onDateFromChange={(value) => { setDateFrom(value); setPage(1); }} onDateToChange={(value) => { setDateTo(value); setPage(1); }} />
          {hasFilters && <button type="button" className="reset-filter" onClick={resetFilters}><X aria-hidden="true" /> Reset</button>}
        </form>
        {error && <div className="data-error" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Data tidak dapat ditampilkan</strong><span>{error}</span></div></div>}
        <div className="table-summary"><p>Menampilkan <strong>{rows.length}</strong> dari <strong>{formatNumber(pagination.total)}</strong> retur penjualan</p></div>
        <div className="data-table-wrapper"><table className="data-table purchase-return-table"><thead><tr><th>Nomor</th><th>Customer / Referensi</th><th>Tanggal</th><th>Alasan</th><th>Produk</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="table-message"><RefreshCw className="is-spinning" aria-hidden="true" /> Memuat retur penjualan...</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="table-message"><PackageX aria-hidden="true" /> Tidak ada retur penjualan yang sesuai.</td></tr> : rows.map((row) => <tr key={row.id}><td data-label="Nomor"><strong className="purchase-return-number">{row.return_number}</strong></td><td data-label="Customer / Referensi"><strong>{row.customer_name}</strong><small>{row.delivery_number} · {row.so_number}</small></td><td data-label="Tanggal">{formatDate(row.return_date)}</td><td data-label="Alasan">{reasonLabels[row.reason] || row.reason}</td><td data-label="Produk">{formatNumber(row.item_count)}</td><td data-label="Total"><strong>{formatCurrency(row.total_amount)}</strong><small>{formatNumber(row.total_quantity)} unit</small></td><td data-label="Status"><span className={`purchase-return-status is-${row.status.toLowerCase()}`}>{statusLabels[row.status]}</span></td><td data-label="Aksi" className="table-action-cell"><button type="button" className="table-edit-action purchase-return-detail-action" disabled={busy} onClick={async () => { try { setBusy(true); setActionError(""); await refreshDetail(row.id); } catch (requestError) { setActionError(requestError.response?.data?.message || "Detail gagal dimuat."); } finally { setBusy(false); } }}><Eye aria-hidden="true" /> Detail</button></td></tr>)}</tbody></table></div>
        <PaginationBar page={page} totalPages={Math.max(pagination.total_pages, 1)} isLoading={loading} onPageChange={setPage} />
      </section>
      {formOpen && <SalesReturnForm busy={busy} error={actionError} onClose={() => { if (!busy) { setFormOpen(false); setActionError(""); } }} onSubmit={createReturn} />}
      {detail && <SalesReturnDetail detail={detail} user={user} busy={busy} error={actionError} dismissDisabled={Boolean(approvalAction) || settlementOpen} onClose={() => { if (!busy) { setDetail(null); setActionError(""); } }} onAction={setApprovalAction} onSettle={() => { setActionError(""); setSettlementOpen(true); }} />}
      {detail && settlementOpen && <SalesReturnSettlementForm detail={detail} busy={busy} error={actionError} onClose={() => { if (!busy) { setSettlementOpen(false); setActionError(""); } }} onSubmit={createSettlement} />}
      <ApprovalActionDialog isOpen={Boolean(approvalAction)} action={approvalAction} transactionLabel="Retur penjualan" transactionNumber={detail?.return_number} isSubmitting={busy} requestError={actionError} onCancel={() => { if (!busy) { setApprovalAction(""); setActionError(""); } }} onConfirm={runAction} />
    </div>
  );
};

export default SalesReturnsPage;
