import {
  Boxes,
  CalendarDays,
  ClipboardList,
  PackageCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect } from "react";
import {
  formatDate,
  formatNumber,
} from "../../utils/formatters";

const purchaseOrderStatusLabels = {
  DRAFT: "Draft",
  SUBMITTED: "Diajukan",
  PARTIALLY_RECEIVED: "Diterima sebagian",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
};

const GoodsReceiptDetailDialog = ({
  isOpen,
  goodsReceipt,
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

  if (!isOpen || !goodsReceipt) {
    return null;
  }

  const items = goodsReceipt.items || [];

  const totalReceived = items.reduce(
    (total, item) =>
      total + Number(item.quantity_received || 0),
    0,
  );

  const totalDamaged = items.reduce(
    (total, item) =>
      total + Number(item.quantity_damaged || 0),
    0,
  );

  const totalAddedToStock = items.reduce(
    (total, item) =>
      total +
      Number(item.quantity_added_to_stock || 0),
    0,
  );

  const statusLabel =
    purchaseOrderStatusLabels[
      goodsReceipt.purchase_order_status
    ] || goodsReceipt.purchase_order_status;

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
        className="goods-receipt-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goods-receipt-detail-title"
      >
        <header className="goods-receipt-detail-header">
          <div>
            <span>Goods Receipt</span>
            <h2 id="goods-receipt-detail-title">
              {goodsReceipt.receipt_number}
            </h2>
          </div>

          <div className="goods-receipt-detail-heading-actions">
            <span
              className={`goods-receipt-detail-status is-${goodsReceipt.purchase_order_status
                ?.toLowerCase()
                .replaceAll("_", "-")}`}
            >
              {statusLabel}
            </span>

            <button
              type="button"
              className="goods-receipt-detail-close"
              aria-label="Tutup detail penerimaan"
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
                <span>Purchase order</span>
                <strong>
                  {goodsReceipt.po_number}
                </strong>
              </div>
            </article>

            <article>
              <PackageCheck aria-hidden="true" />

              <div>
                <span>Supplier</span>
                <strong>
                  {goodsReceipt.supplier_name}
                </strong>
                <small>
                  {goodsReceipt.supplier_code}
                </small>
              </div>
            </article>

            <article>
              <CalendarDays aria-hidden="true" />

              <div>
                <span>Tanggal penerimaan</span>
                <strong>
                  {formatDate(
                    goodsReceipt.received_date,
                  )}
                </strong>
              </div>
            </article>

            <article>
              <UserRound aria-hidden="true" />

              <div>
                <span>Diterima oleh</span>
                <strong>
                  {goodsReceipt.received_by_name ||
                    "-"}
                </strong>
              </div>
            </article>
          </section>

          <section className="goods-receipt-detail-totals">
            <article>
              <span>Total item</span>
              <strong>
                {formatNumber(items.length)}
              </strong>
            </article>

            <article>
              <span>Total diterima</span>
              <strong>
                {formatNumber(totalReceived)}
              </strong>
            </article>

            <article className="is-damaged">
              <span>Barang rusak</span>
              <strong>
                {formatNumber(totalDamaged)}
              </strong>
            </article>

            <article className="is-stock">
              <span>Masuk stok</span>
              <strong>
                {formatNumber(totalAddedToStock)}
              </strong>
            </article>
          </section>

          <section className="goods-receipt-detail-notes">
            <span>Catatan penerimaan</span>
            <p>
              {goodsReceipt.notes ||
                "Tidak ada catatan penerimaan."}
            </p>
          </section>

          <section className="goods-receipt-detail-items">
            <div className="goods-receipt-detail-section-heading">
              <div>
                <strong>Rincian barang</strong>
                <span>
                  Kuantitas yang diterima dan kondisi
                  barang.
                </span>
              </div>

              <Boxes aria-hidden="true" />
            </div>

            <div className="goods-receipt-detail-table-wrapper">
              <table className="goods-receipt-detail-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Dipesan</th>
                    <th>Diterima</th>
                    <th>Rusak</th>
                    <th>Masuk stok</th>
                    <th>Total diterima</th>
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

                      <td data-label="Diterima">
                        {formatNumber(
                          item.quantity_received,
                        )}
                      </td>

                      <td data-label="Rusak">
                        <strong
                          className={
                            Number(
                              item.quantity_damaged,
                            ) > 0
                              ? "has-damage"
                              : ""
                          }
                        >
                          {formatNumber(
                            item.quantity_damaged,
                          )}
                        </strong>
                      </td>

                      <td data-label="Masuk stok">
                        <strong className="is-stock">
                          {formatNumber(
                            item
                              .quantity_added_to_stock,
                          )}
                        </strong>
                      </td>

                      <td data-label="Total diterima">
                        {formatNumber(
                          item
                            .total_received_quantity,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

export default GoodsReceiptDetailDialog;