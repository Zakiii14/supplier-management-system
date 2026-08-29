import {
  CalendarDays,
  ClipboardList,
  Clock3,
  ReceiptText,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect } from "react";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../../utils/formatters";

const statusPresentation = {
  UNPAID: {
    label: "Belum dibayar",
    className: "is-unpaid",
  },
  PARTIAL: {
    label: "Dibayar sebagian",
    className: "is-partial",
  },
  PAID: {
    label: "Lunas",
    className: "is-paid",
  },
  OVERDUE: {
    label: "Jatuh tempo",
    className: "is-overdue",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "is-cancelled",
  },
};

const paymentMethodLabels = {
  CASH: "Tunai",
  BANK_TRANSFER: "Transfer bank",
  GIRO: "Giro",
  OTHER: "Lainnya",
};

const InvoiceDetailDialog = ({
  isOpen,
  invoice,
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

  if (!isOpen || !invoice) {
    return null;
  }

  const items = Array.isArray(invoice.items)
    ? invoice.items
    : [];

  const payments = Array.isArray(
    invoice.payments,
  )
    ? invoice.payments
    : [];

  const presentation =
    statusPresentation[invoice.status] ?? {
      label: invoice.status,
      className: "is-unpaid",
    };

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
        className="purchase-order-detail-dialog invoice-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-detail-title"
      >
        <header className="purchase-order-detail-header">
          <div>
            <p>Invoice</p>

            <h2 id="invoice-detail-title">
              {invoice.invoice_number}
            </h2>

            <span>
              {invoice.customer_name}{" "}
              <strong>
                ({invoice.customer_code})
              </strong>
            </span>
          </div>

          <div className="purchase-order-detail-heading-actions">
            <span
              className={`invoice-status ${presentation.className}`}
            >
              {presentation.label}
            </span>

            <button
              type="button"
              className="purchase-order-detail-close"
              aria-label="Tutup detail invoice"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="purchase-order-detail-content">
          <section
            className="purchase-order-detail-summary"
            aria-label="Ringkasan invoice"
          >
            <article>
              <ClipboardList aria-hidden="true" />

              <div>
                <span>Sales order</span>

                <strong>
                  {invoice.so_number}
                </strong>
              </div>
            </article>

            <article>
              <UserRound aria-hidden="true" />

              <div>
                <span>Customer</span>

                <strong>
                  {invoice.customer_name}
                </strong>
              </div>
            </article>

            <article>
              <CalendarDays aria-hidden="true" />

              <div>
                <span>Tanggal invoice</span>

                <strong>
                  {formatDate(
                    invoice.invoice_date,
                  )}
                </strong>
              </div>
            </article>

            <article>
              <Clock3 aria-hidden="true" />

              <div>
                <span>Jatuh tempo</span>

                <strong>
                  {formatDate(invoice.due_date)}
                </strong>
              </div>
            </article>
          </section>

          <section className="invoice-detail-totals">
            <article>
              <span>Grand total</span>

              <strong>
                {formatCurrency(
                  invoice.grand_total,
                )}
              </strong>
            </article>

            <article className="is-paid">
              <span>Sudah dibayar</span>

              <strong>
                {formatCurrency(
                  invoice.paid_amount,
                )}
              </strong>
            </article>

            <article className="is-outstanding">
              <span>Sisa tagihan</span>

              <strong>
                {formatCurrency(
                  invoice.outstanding_amount,
                )}
              </strong>
            </article>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Informasi customer</span>

            <p>
              {[
                invoice.contact_person,
                invoice.phone,
                invoice.email,
                invoice.city,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "Informasi kontak tidak tersedia."}
            </p>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Alamat penagihan</span>

            <p>
              {invoice.address ||
                "Alamat customer tidak tersedia."}
            </p>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Catatan invoice</span>

            <p>
              {invoice.notes ||
                "Tidak ada catatan invoice."}
            </p>
          </section>

          <section className="invoice-detail-calculation">
            <div>
              <span>Subtotal</span>

              <strong>
                {formatCurrency(invoice.subtotal)}
              </strong>
            </div>

            <div>
              <span>Diskon</span>

              <strong>
                -{" "}
                {formatCurrency(
                  invoice.discount_amount,
                )}
              </strong>
            </div>

            <div>
              <span>Pajak</span>

              <strong>
                {formatCurrency(
                  invoice.tax_amount,
                )}
              </strong>
            </div>

            <div className="is-total">
              <span>Total invoice</span>

              <strong>
                {formatCurrency(
                  invoice.grand_total,
                )}
              </strong>
            </div>
          </section>

          <section className="purchase-order-detail-items">
            <div className="purchase-order-detail-section-heading">
              <div>
                <p>Rincian produk</p>

                <span>
                  Produk dan nilai transaksi dari
                  sales order.
                </span>
              </div>

              <strong>
                {formatNumber(items.length)} item
              </strong>
            </div>

            <div className="purchase-order-detail-table-wrapper">
              <table className="purchase-order-detail-table invoice-detail-table">
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

          <section className="invoice-detail-payments">
            <div className="purchase-order-detail-section-heading">
              <div>
                <p>Riwayat pembayaran</p>

                <span>
                  Pembayaran yang telah diterima untuk
                  invoice ini.
                </span>
              </div>

              <WalletCards aria-hidden="true" />
            </div>

            {payments.length === 0 ? (
              <div className="purchase-order-form-hint">
                Belum ada pembayaran untuk invoice
                ini.
              </div>
            ) : (
              <div className="purchase-order-detail-table-wrapper">
                <table className="purchase-order-detail-table invoice-payment-table">
                  <thead>
                    <tr>
                      <th>Nomor pembayaran</th>
                      <th>Tanggal</th>
                      <th>Metode</th>
                      <th>Referensi</th>
                      <th>Jumlah</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td data-label="Nomor pembayaran">
                          <strong>
                            {
                              payment.payment_number
                            }
                          </strong>

                          <span>
                            {payment.received_by_name ||
                              "Penerima tidak tersedia"}
                          </span>
                        </td>

                        <td data-label="Tanggal">
                          {formatDate(
                            payment.payment_date,
                          )}
                        </td>

                        <td data-label="Metode">
                          {paymentMethodLabels[
                            payment.method
                          ] || payment.method}
                        </td>

                        <td data-label="Referensi">
                          {payment.reference_number ||
                            "-"}
                        </td>

                        <td data-label="Jumlah">
                          <strong>
                            {formatCurrency(
                              payment.amount,
                            )}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="invoice-detail-status-note">
            <ReceiptText aria-hidden="true" />

            <div>
              <strong>
                {presentation.label}
              </strong>

              <span>
                {invoice.status === "UNPAID" &&
                  "Invoice belum menerima pembayaran."}

                {invoice.status === "PARTIAL" &&
                  "Sebagian tagihan telah dibayar dan masih memiliki sisa pembayaran."}

                {invoice.status === "PAID" &&
                  "Seluruh nilai invoice telah dibayar."}

                {invoice.status === "OVERDUE" &&
                  "Invoice telah melewati tanggal jatuh tempo dan masih memiliki tagihan."}

                {invoice.status ===
                  "CANCELLED" &&
                  "Invoice telah dibatalkan dan tidak dapat menerima pembayaran."}
              </span>
            </div>
          </section>
        </div>

        <footer className="purchase-order-detail-footer">
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

export default InvoiceDetailDialog;