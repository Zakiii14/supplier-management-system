import { useEffect, useState } from "react";
import {
  CalendarDays,
  PackageCheck,
  Plus,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../../utils/formatters";
import { PaymentProofManager } from "../payments/PaymentProofField";
import SupplierPaymentFormModal from "./SupplierPaymentFormModal";

const paymentSchemeLabels = {
  DIRECT: "Pembayaran langsung",
  TERM: "Termin",
  DOWN_PAYMENT: "DP dan pelunasan",
  COD: "COD",
};

const paymentStatusLabels = {
  NOT_RECORDED: "Belum dicatat",
  PARTIAL: "Dibayar sebagian",
  PAID: "Lunas",
};

const paymentMethodLabels = {
  BANK_TRANSFER: "Transfer bank",
  CASH: "Tunai",
  GIRO: "Giro",
  OTHER: "Lainnya",
};

const statusPresentation = {
  DRAFT: {
    label: "Draft",
    className: "is-draft",
  },
  SUBMITTED: {
    label: "Diajukan",
    className: "is-submitted",
  },
  PARTIALLY_RECEIVED: {
    label: "Diterima sebagian",
    className: "is-partially-received",
  },
  RECEIVED: {
    label: "Diterima",
    className: "is-received",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "is-cancelled",
  },
};

const PurchaseOrderDetailDialog = ({
  isOpen,
  purchaseOrder,
  canManageSupplierPayments = false,
  requireTransferProof = false,
  onCreateSupplierPayment,
  onAddSupplierProofs,
  onReplaceSupplierProof,
  onDeleteSupplierProof,
  onOpenSupplierProof,
  onClose,
}) => {
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, onClose]);

  if (!isOpen || !purchaseOrder) {
    return null;
  }

  const presentation =
    statusPresentation[purchaseOrder.status] ?? {
      label: purchaseOrder.status,
      className: "is-draft",
    };

  const items = Array.isArray(purchaseOrder.items)
    ? purchaseOrder.items
    : [];
  const supplierPayments = Array.isArray(purchaseOrder.supplier_payments)
    ? purchaseOrder.supplier_payments
    : [];

  return (
    <div
      className="purchase-order-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="purchase-order-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-order-detail-title"
      >
        <header className="purchase-order-detail-header">
          <div>
            <p>Purchase Order</p>
            <h2 id="purchase-order-detail-title">
              {purchaseOrder.po_number}
            </h2>
            <span>
              {purchaseOrder.supplier_name}{" "}
              <strong>
                ({purchaseOrder.supplier_code})
              </strong>
            </span>
          </div>

          <div className="purchase-order-detail-heading-actions">
            <span
              className={`purchase-order-status ${presentation.className}`}
            >
              {presentation.label}
            </span>

            <button
              type="button"
              className="purchase-order-detail-close"
              aria-label="Tutup detail purchase order"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="purchase-order-detail-content">
          <section
            className="purchase-order-detail-summary"
            aria-label="Ringkasan purchase order"
          >
            <article>
              <CalendarDays aria-hidden="true" />
              <div>
                <span>Tanggal pesan</span>
                <strong>
                  {formatDate(purchaseOrder.order_date)}
                </strong>
              </div>
            </article>

            <article>
              <Truck aria-hidden="true" />
              <div>
                <span>Estimasi tiba</span>
                <strong>
                  {formatDate(
                    purchaseOrder.expected_date,
                  )}
                </strong>
              </div>
            </article>

            <article>
              <PackageCheck aria-hidden="true" />
              <div>
                <span>Jenis item</span>
                <strong>
                  {formatNumber(items.length)} produk
                </strong>
              </div>
            </article>

            <article className="is-total">
              <div>
                <span>Total purchase order</span>
                <strong>
                  {formatCurrency(
                    purchaseOrder.total_amount,
                  )}
                </strong>
              </div>
            </article>

            <article>
              <WalletCards aria-hidden="true" />
              <div>
                <span>Ketentuan pembayaran</span>
                <strong>
                  {paymentSchemeLabels[purchaseOrder.payment_scheme] ||
                    purchaseOrder.payment_scheme}
                </strong>
                {purchaseOrder.payment_scheme === "TERM" && (
                  <small>
                    {formatNumber(purchaseOrder.payment_terms_days)} hari
                  </small>
                )}
                {purchaseOrder.payment_scheme === "DOWN_PAYMENT" && (
                  <small>
                    DP {formatNumber(purchaseOrder.down_payment_percent)}%
                  </small>
                )}
              </div>
            </article>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Catatan</span>
            <p>{purchaseOrder.notes || "Tidak ada catatan."}</p>
          </section>

          <section className="purchase-order-detail-items">
            <div className="purchase-order-detail-section-heading">
              <div>
                <p>Rincian produk</p>
                <span>
                  Kuantitas pesanan dan progres penerimaan.
                </span>
              </div>

              <strong>{formatNumber(items.length)} item</strong>
            </div>

            <div className="purchase-order-detail-table-wrapper">
              <table className="purchase-order-detail-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Pesan</th>
                    <th>Diterima</th>
                    <th>Sisa</th>
                    <th>Harga satuan</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const orderedQuantity =
                      Number(item.quantity) || 0;
                    const receivedQuantity =
                      Number(item.received_quantity) || 0;
                    const remainingQuantity = Math.max(
                      orderedQuantity - receivedQuantity,
                      0,
                    );

                    return (
                      <tr key={item.id}>
                        <td data-label="Produk">
                          <strong>
                            {item.product_name}
                          </strong>
                          <span>
                            {item.sku} · {item.unit}
                          </span>
                        </td>

                        <td data-label="Pesan">
                          {formatNumber(orderedQuantity)}
                        </td>

                        <td data-label="Diterima">
                          {formatNumber(receivedQuantity)}
                        </td>

                        <td data-label="Sisa">
                          {formatNumber(remainingQuantity)}
                        </td>

                        <td data-label="Harga satuan">
                          {formatCurrency(item.unit_price)}
                        </td>

                        <td data-label="Subtotal">
                          <strong>
                            {formatCurrency(item.subtotal)}
                          </strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {purchaseOrder.can_view_supplier_payments && (
            <section className="supplier-payment-section">
              <div className="purchase-order-detail-section-heading">
                <div>
                  <p>Pembayaran supplier</p>
                  <span>
                    {paymentStatusLabels[purchaseOrder.payment_status] ||
                      purchaseOrder.payment_status}
                    {" · "}sisa {formatCurrency(purchaseOrder.outstanding_amount)}
                  </span>
                </div>
                {canManageSupplierPayments &&
                  !["DRAFT", "CANCELLED"].includes(purchaseOrder.status) &&
                  Number(purchaseOrder.outstanding_amount) > 0 && (
                    <button
                      type="button"
                      className="supplier-payment-add"
                      onClick={() => setIsPaymentFormOpen(true)}
                    >
                      <Plus aria-hidden="true" /> Catat pembayaran
                    </button>
                  )}
              </div>

              <div className="supplier-payment-totals">
                <article>
                  <span>Total PO</span>
                  <strong>{formatCurrency(purchaseOrder.total_amount)}</strong>
                </article>
                <article>
                  <span>Sudah dibayar</span>
                  <strong>{formatCurrency(purchaseOrder.paid_amount)}</strong>
                </article>
                <article>
                  <span>Sisa pembayaran</span>
                  <strong>{formatCurrency(purchaseOrder.outstanding_amount)}</strong>
                </article>
              </div>

              {supplierPayments.length === 0 ? (
                <div className="payment-proof-empty">
                  Belum ada pembayaran supplier yang dicatat.
                </div>
              ) : (
                <div className="supplier-payment-list">
                  {supplierPayments.map((payment) => (
                    <article key={payment.id} className="supplier-payment-card">
                      <header>
                        <div>
                          <strong>{payment.payment_number}</strong>
                          <span>{formatDate(payment.payment_date)}</span>
                        </div>
                        <strong>{formatCurrency(payment.amount)}</strong>
                      </header>
                      <div className="supplier-payment-meta">
                        <span>{paymentMethodLabels[payment.method] || payment.method}</span>
                        <span>Referensi: {payment.reference_number || "-"}</span>
                        <span>
                          Invoice supplier: {payment.supplier_invoice_number || "-"}
                        </span>
                        <span>Dicatat oleh: {payment.paid_by_name || "-"}</span>
                      </div>
                      <PaymentProofManager
                        proofs={payment.proofs || []}
                        canManage={canManageSupplierPayments}
                        onAdd={(files) => onAddSupplierProofs(payment.id, files)}
                        onReplace={(proofId, file) =>
                          onReplaceSupplierProof(payment.id, proofId, file)
                        }
                        onDelete={(proofId) =>
                          onDeleteSupplierProof(payment.id, proofId)
                        }
                        onOpen={(proofId) =>
                          onOpenSupplierProof(payment.id, proofId)
                        }
                      />
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="purchase-order-detail-footer">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </footer>

        {isPaymentFormOpen && (
          <SupplierPaymentFormModal
            isOpen
            purchaseOrder={purchaseOrder}
            requireTransferProof={requireTransferProof}
            onClose={() => setIsPaymentFormOpen(false)}
            onSubmit={onCreateSupplierPayment}
          />
        )}
      </section>
    </div>
  );
};

export default PurchaseOrderDetailDialog;
