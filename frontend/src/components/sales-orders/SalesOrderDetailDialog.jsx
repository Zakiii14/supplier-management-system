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
  CONFIRMED: {
    label: "Dikonfirmasi",
    className: "is-confirmed",
  },
  PARTIALLY_DELIVERED: {
    label: "Dikirim sebagian",
    className: "is-partially-delivered",
  },
  DELIVERED: {
    label: "Terkirim",
    className: "is-delivered",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "is-cancelled",
  },
};

const SalesOrderDetailDialog = ({
  isOpen,
  salesOrder,
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
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, onClose]);

  if (!isOpen || !salesOrder) {
    return null;
  }

  const presentation =
    statusPresentation[salesOrder.status] ?? {
      label: salesOrder.status,
      className: "is-draft",
    };

  const items = Array.isArray(salesOrder.items)
    ? salesOrder.items
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
        aria-labelledby="sales-order-detail-title"
      >
        <header className="purchase-order-detail-header">
          <div>
            <p>Sales Order</p>

            <h2 id="sales-order-detail-title">
              {salesOrder.so_number}
            </h2>

            <span>
              {salesOrder.customer_name}{" "}
              <strong>
                ({salesOrder.customer_code})
              </strong>
            </span>
          </div>

          <div className="purchase-order-detail-heading-actions">
            <span
              className={`sales-order-status ${presentation.className}`}
            >
              {presentation.label}
            </span>

            <button
              type="button"
              className="purchase-order-detail-close"
              aria-label="Tutup detail sales order"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="purchase-order-detail-content">
          <section
            className="purchase-order-detail-summary"
            aria-label="Ringkasan sales order"
          >
            <article>
              <CalendarDays aria-hidden="true" />

              <div>
                <span>Tanggal pesanan</span>
                <strong>
                  {formatDate(salesOrder.order_date)}
                </strong>
              </div>
            </article>

            <article>
              <Truck aria-hidden="true" />

              <div>
                <span>Permintaan pengiriman</span>
                <strong>
                  {formatDate(
                    salesOrder.requested_delivery_date,
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
                <span>Total sales order</span>
                <strong>
                  {formatCurrency(
                    salesOrder.total_amount,
                  )}
                </strong>
              </div>
            </article>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Informasi customer</span>

            <p>
              {[
                salesOrder.contact_person,
                salesOrder.phone,
                salesOrder.email,
                salesOrder.city,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "Tidak ada informasi kontak tambahan."}
            </p>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Alamat pengiriman</span>

            <p>
              {salesOrder.address ||
                "Alamat belum tersedia."}
            </p>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Catatan</span>

            <p>
              {salesOrder.notes ||
                "Tidak ada catatan."}
            </p>
          </section>

          <section className="purchase-order-detail-items">
            <div className="purchase-order-detail-section-heading">
              <div>
                <p>Rincian produk</p>

                <span>
                  Kuantitas, harga jual, diskon, dan
                  subtotal pesanan.
                </span>
              </div>

              <strong>
                {formatNumber(items.length)} item
              </strong>
            </div>

            <div className="purchase-order-detail-table-wrapper">
              <table className="purchase-order-detail-table sales-order-detail-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Jumlah</th>
                    <th>Harga satuan</th>
                    <th>Diskon</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Produk">
                        <strong>
                          {item.product_name}
                        </strong>

                        <span>
                          {item.sku} · {item.unit}
                        </span>
                      </td>

                      <td data-label="Jumlah">
                        {formatNumber(item.quantity)}
                      </td>

                      <td data-label="Harga satuan">
                        {formatCurrency(
                          item.unit_price,
                        )}
                      </td>

                      <td data-label="Diskon">
                        {formatCurrency(
                          item.discount_amount,
                        )}
                      </td>

                      <td data-label="Subtotal">
                        <strong>
                          {formatCurrency(
                            item.subtotal,
                          )}
                        </strong>
                      </td>
                    </tr>
                  ))}
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

export default SalesOrderDetailDialog;