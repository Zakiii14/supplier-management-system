import {
  CalendarDays,
  ClipboardList,
  Landmark,
  ReceiptText,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect } from "react";
import {
  formatCurrency,
  formatDate,
} from "../../utils/formatters";

const paymentMethodPresentation = {
  CASH: {
    label: "Tunai",
    className: "is-cash",
  },
  BANK_TRANSFER: {
    label: "Transfer bank",
    className: "is-bank-transfer",
  },
  GIRO: {
    label: "Giro",
    className: "is-giro",
  },
  OTHER: {
    label: "Lainnya",
    className: "is-other",
  },
};

const invoiceStatusPresentation = {
  UNPAID: {
    label: "Belum dibayar",
    className: "is-unpaid",
    description:
      "Invoice belum menerima pembayaran penuh.",
  },
  PARTIAL: {
    label: "Dibayar sebagian",
    className: "is-partial",
    description:
      "Invoice masih memiliki sisa tagihan yang perlu dibayar.",
  },
  PAID: {
    label: "Lunas",
    className: "is-paid",
    description:
      "Seluruh nilai invoice telah dibayar.",
  },
  OVERDUE: {
    label: "Jatuh tempo",
    className: "is-overdue",
    description:
      "Invoice telah melewati tanggal jatuh tempo dan masih memiliki tagihan.",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "is-cancelled",
    description:
      "Invoice telah dibatalkan dan tidak dapat menerima pembayaran.",
  },
};

const PaymentDetailDialog = ({
  isOpen,
  payment,
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

  if (!isOpen || !payment) {
    return null;
  }

  const methodPresentation =
    paymentMethodPresentation[payment.method] ?? {
      label: payment.method || "-",
      className: "is-other",
    };

  const invoicePresentation =
    invoiceStatusPresentation[
      payment.invoice_status
    ] ?? {
      label: payment.invoice_status || "-",
      className: "is-unpaid",
      description:
        "Status invoice tidak tersedia.",
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
        className="purchase-order-detail-dialog payment-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-detail-title"
      >
        <header className="purchase-order-detail-header">
          <div>
            <p>Pembayaran</p>

            <h2 id="payment-detail-title">
              {payment.payment_number}
            </h2>

            <span>
              {payment.customer_name}{" "}
              <strong>
                ({payment.customer_code})
              </strong>
            </span>
          </div>

          <div className="purchase-order-detail-heading-actions">
            <span
              className={`payment-method-badge ${methodPresentation.className}`}
            >
              {methodPresentation.label}
            </span>

            <button
              type="button"
              className="purchase-order-detail-close"
              aria-label="Tutup detail pembayaran"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="purchase-order-detail-content">
          <section
            className="purchase-order-detail-summary"
            aria-label="Ringkasan pembayaran"
          >
            <article>
              <ClipboardList aria-hidden="true" />

              <div>
                <span>Invoice</span>

                <strong>
                  {payment.invoice_number}
                </strong>

                <small>{payment.so_number}</small>
              </div>
            </article>

            <article>
              <UserRound aria-hidden="true" />

              <div>
                <span>Customer</span>

                <strong>
                  {payment.customer_name}
                </strong>

                <small>
                  {payment.customer_code}
                </small>
              </div>
            </article>

            <article>
              <CalendarDays aria-hidden="true" />

              <div>
                <span>Tanggal pembayaran</span>

                <strong>
                  {formatDate(
                    payment.payment_date,
                  )}
                </strong>
              </div>
            </article>

            <article>
              <ReceiptText aria-hidden="true" />

              <div>
                <span>Diterima oleh</span>

                <strong>
                  {payment.received_by_name ||
                    "Penerima tidak tersedia"}
                </strong>
              </div>
            </article>
          </section>

          <section className="payment-detail-primary">
            <div className="payment-detail-amount">
              <WalletCards aria-hidden="true" />

              <div>
                <span>Jumlah pembayaran</span>

                <strong>
                  {formatCurrency(payment.amount)}
                </strong>
              </div>
            </div>

            <div className="payment-detail-reference">
              <article>
                <Landmark aria-hidden="true" />

                <div>
                  <span>Metode pembayaran</span>

                  <strong>
                    {methodPresentation.label}
                  </strong>
                </div>
              </article>

              <article>
                <ReceiptText aria-hidden="true" />

                <div>
                  <span>Nomor referensi</span>

                  <strong>
                    {payment.reference_number || "-"}
                  </strong>
                </div>
              </article>
            </div>
          </section>

          <section className="payment-detail-invoice-summary">
            <article>
              <span>Nilai invoice</span>

              <strong>
                {formatCurrency(
                  payment.grand_total,
                )}
              </strong>
            </article>

            <article className="is-paid">
              <span>Total sudah dibayar</span>

              <strong>
                {formatCurrency(
                  payment.paid_amount,
                )}
              </strong>
            </article>

            <article className="is-outstanding">
              <span>Sisa tagihan</span>

              <strong>
                {formatCurrency(
                  payment.outstanding_amount,
                )}
              </strong>
            </article>
          </section>

          <section className="payment-detail-dates">
            <article>
              <span>Tanggal invoice</span>

              <strong>
                {formatDate(payment.invoice_date)}
              </strong>
            </article>

            <article>
              <span>Jatuh tempo</span>

              <strong>
                {formatDate(payment.due_date)}
              </strong>
            </article>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Informasi customer</span>

            <p>
              {[
                payment.contact_person,
                payment.phone,
                payment.email,
                payment.city,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "Informasi kontak tidak tersedia."}
            </p>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Alamat customer</span>

            <p>
              {payment.address ||
                "Alamat customer tidak tersedia."}
            </p>
          </section>

          <section className="purchase-order-detail-notes">
            <span>Catatan pembayaran</span>

            <p>
              {payment.notes ||
                "Tidak ada catatan pembayaran."}
            </p>
          </section>

          <section className="payment-detail-status-note">
            <ReceiptText aria-hidden="true" />

            <div>
              <span>Status invoice</span>

              <strong
                className={`invoice-status ${invoicePresentation.className}`}
              >
                {invoicePresentation.label}
              </strong>

              <p>
                {invoicePresentation.description}
              </p>
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

export default PaymentDetailDialog;
