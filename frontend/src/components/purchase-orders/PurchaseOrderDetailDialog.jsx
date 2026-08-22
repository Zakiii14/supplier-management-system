import { useEffect } from "react";
import {
  CalendarDays,
  PackageCheck,
  Truck,
  X,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../../utils/formatters";

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
  onClose,
}) => {
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
        </div>

        <footer className="purchase-order-detail-footer">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </footer>
      </section>
    </div>
  );
};

export default PurchaseOrderDetailDialog;