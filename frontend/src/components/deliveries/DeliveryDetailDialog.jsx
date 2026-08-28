import {
  Boxes,
  CalendarDays,
  ClipboardList,
  MapPin,
  PackageCheck,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect } from "react";
import {
  formatDate,
  formatNumber,
} from "../../utils/formatters";

const statusPresentation = {
  PENDING: {
    label: "Menunggu",
    className: "is-pending",
  },
  SHIPPED: {
    label: "Dalam pengiriman",
    className: "is-shipped",
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

const salesOrderStatusLabels = {
  DRAFT: "Draft",
  CONFIRMED: "Dikonfirmasi",
  PARTIALLY_DELIVERED: "Dikirim sebagian",
  DELIVERED: "Terkirim",
  CANCELLED: "Dibatalkan",
};

const DeliveryDetailDialog = ({
  isOpen,
  delivery,
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

  if (!isOpen || !delivery) {
    return null;
  }

  const items = Array.isArray(delivery.items)
    ? delivery.items
    : [];

  const totalQuantity = items.reduce(
    (total, item) =>
      total +
      Number(item.quantity_delivered || 0),
    0,
  );

  const presentation =
    statusPresentation[delivery.status] ?? {
      label: delivery.status,
      className: "is-pending",
    };

  const salesOrderStatus =
    salesOrderStatusLabels[
      delivery.sales_order_status
    ] || delivery.sales_order_status;

  return (
    <div
      className="goods-receipt-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="goods-receipt-detail-dialog delivery-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-detail-title"
      >
        <header className="goods-receipt-detail-header">
          <div>
            <span>Delivery</span>

            <h2 id="delivery-detail-title">
              {delivery.delivery_number}
            </h2>
          </div>

          <div className="goods-receipt-detail-heading-actions">
            <span
              className={`delivery-status ${presentation.className}`}
            >
              {presentation.label}
            </span>

            <button
              type="button"
              className="goods-receipt-detail-close"
              aria-label="Tutup detail pengiriman"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="goods-receipt-detail-content">
          <section className="goods-receipt-detail-summary">
            <article>
              <ClipboardList aria-hidden="true" />

              <div>
                <span>Sales order</span>

                <strong>
                  {delivery.so_number}
                </strong>
              </div>
            </article>

            <article>
              <PackageCheck aria-hidden="true" />

              <div>
                <span>Customer</span>

                <strong>
                  {delivery.customer_name}
                </strong>

                <small>
                  {delivery.customer_code}
                </small>
              </div>
            </article>

            <article>
              <CalendarDays aria-hidden="true" />

              <div>
                <span>Tanggal pengiriman</span>

                <strong>
                  {formatDate(
                    delivery.delivery_date,
                  )}
                </strong>
              </div>
            </article>

            <article>
              <UserRound aria-hidden="true" />

              <div>
                <span>Penerima</span>

                <strong>
                  {delivery.recipient_name || "-"}
                </strong>
              </div>
            </article>
          </section>

          <section className="goods-receipt-detail-totals">
            <article>
              <span>Jenis produk</span>

              <strong>
                {formatNumber(items.length)}
              </strong>
            </article>

            <article className="is-stock">
              <span>Total kuantitas</span>

              <strong>
                {formatNumber(totalQuantity)}
              </strong>
            </article>

            <article>
              <span>Status sales order</span>

              <strong>
                {salesOrderStatus || "-"}
              </strong>
            </article>

            <article>
              <span>Diterima pada</span>

              <strong>
                {formatDate(delivery.delivered_at)}
              </strong>
            </article>
          </section>

          <section className="goods-receipt-detail-notes delivery-detail-information">
            <div>
              <MapPin aria-hidden="true" />

              <span>Alamat pengiriman</span>
            </div>

            <p>
              {delivery.address ||
                "Alamat pengiriman tidak tersedia."}
            </p>
          </section>

          <section className="goods-receipt-detail-notes delivery-detail-information">
            <div>
              <UserRound aria-hidden="true" />

              <span>Kontak customer</span>
            </div>

            <p>
              {[
                delivery.contact_person,
                delivery.phone,
                delivery.email,
                delivery.city,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "Informasi kontak tidak tersedia."}
            </p>
          </section>

          <section className="goods-receipt-detail-notes">
            <span>Catatan pengiriman</span>

            <p>
              {delivery.notes ||
                "Tidak ada catatan pengiriman."}
            </p>
          </section>

          <section className="goods-receipt-detail-items">
            <div className="goods-receipt-detail-section-heading">
              <div>
                <strong>Rincian barang</strong>

                <span>
                  Perbandingan jumlah pesanan dan
                  jumlah pada pengiriman ini.
                </span>
              </div>

              <Boxes aria-hidden="true" />
            </div>

            <div className="goods-receipt-detail-table-wrapper">
              <table className="goods-receipt-detail-table delivery-detail-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Dipesan</th>
                    <th>Dikirim</th>
                    <th>Stok saat ini</th>
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

                      <td data-label="Dipesan">
                        {formatNumber(
                          item.ordered_quantity,
                        )}
                      </td>

                      <td data-label="Dikirim">
                        <strong className="is-stock">
                          {formatNumber(
                            item.quantity_delivered,
                          )}
                        </strong>
                      </td>

                      <td data-label="Stok saat ini">
                        {formatNumber(
                          item.current_stock,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="delivery-detail-status-note">
            <Truck aria-hidden="true" />

            <div>
              <strong>
                {presentation.label}
              </strong>

              <span>
                {delivery.status === "PENDING" &&
                  "Pengiriman masih menunggu proses warehouse."}

                {delivery.status === "SHIPPED" &&
                  "Barang sudah keluar dari stok dan sedang dalam perjalanan."}

                {delivery.status === "DELIVERED" &&
                  "Barang telah diterima oleh customer."}

                {delivery.status === "CANCELLED" &&
                  "Pengiriman dibatalkan sebelum barang dikirim."}
              </span>
            </div>
          </section>
        </div>

        <footer className="goods-receipt-detail-footer">
          <button
            type="button"
            onClick={onClose}
          >
            Tutup
          </button>
        </footer>
      </section>
    </div>
  );
};

export default DeliveryDetailDialog;