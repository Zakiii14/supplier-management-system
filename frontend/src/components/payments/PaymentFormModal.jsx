import {
  CalendarDays,
  ReceiptText,
  Save,
  WalletCards,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  formatCurrency,
  formatDate,
} from "../../utils/formatters";
import FormDatePicker from "../forms/FormDatePicker";
import FormSelect from "../forms/FormSelect";

const paymentMethodOptions = [
  {
    value: "BANK_TRANSFER",
    label: "Transfer bank",
  },
  {
    value: "CASH",
    label: "Tunai",
  },
  {
    value: "GIRO",
    label: "Giro",
  },
  {
    value: "OTHER",
    label: "Lainnya",
  },
];

const invoiceStatusLabels = {
  UNPAID: "Belum dibayar",
  PARTIAL: "Dibayar sebagian",
  OVERDUE: "Jatuh tempo",
};

const getTodayValue = () =>
  new Date().toISOString().slice(0, 10);

const createInitialValues = () => ({
  payment_number: "",
  invoice_id: "",
  payment_date: getTodayValue(),
  amount: "",
  method: "BANK_TRANSFER",
  reference_number: "",
  notes: "",
});

const PaymentFormModal = ({
  isOpen,
  invoices = [],
  isSubmitting = false,
  requestError = "",
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState(
    createInitialValues,
  );

  const [validationError, setValidationError] =
    useState("");

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
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
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const selectedInvoice =
    invoices.find(
      (invoice) =>
        invoice.id === values.invoice_id,
    ) || null;

  const outstandingAmount = Number(
    selectedInvoice?.outstanding_amount || 0,
  );

  const paymentAmount =
    Number(values.amount) || 0;

  const remainingAfterPayment = Math.max(
    outstandingAmount - paymentAmount,
    0,
  );

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setValues((currentValues) => ({
      ...currentValues,
      [name]:
        name === "payment_number"
          ? value.toUpperCase()
          : value,
    }));

    setValidationError("");
  };

  const handleInvoiceChange = (invoiceId) => {
    const nextInvoice = invoices.find(
      (invoice) => invoice.id === invoiceId,
    );

    setValues((currentValues) => ({
      ...currentValues,
      invoice_id: invoiceId,
      payment_date:
        nextInvoice?.invoice_date &&
        currentValues.payment_date <
          nextInvoice.invoice_date
          ? nextInvoice.invoice_date
          : currentValues.payment_date,
      amount: "",
    }));

    setValidationError("");
  };

  const handleDateChange = (value) => {
    setValues((currentValues) => ({
      ...currentValues,
      payment_date: value,
    }));

    setValidationError("");
  };

  const handleMethodChange = (method) => {
    setValues((currentValues) => ({
      ...currentValues,
      method,
    }));

    setValidationError("");
  };

  const handleUseOutstandingAmount = () => {
    setValues((currentValues) => ({
      ...currentValues,
      amount: String(outstandingAmount),
    }));

    setValidationError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !values.payment_number.trim() ||
      !values.invoice_id ||
      !values.payment_date ||
      !values.method
    ) {
      setValidationError(
        "Nomor pembayaran, invoice, tanggal, dan metode wajib diisi.",
      );
      return;
    }

    if (!selectedInvoice) {
      setValidationError(
        "Invoice yang dipilih tidak tersedia.",
      );
      return;
    }

    if (
      !Number.isFinite(Number(values.amount)) ||
      Number(values.amount) <= 0
    ) {
      setValidationError(
        "Nominal pembayaran harus lebih dari nol.",
      );
      return;
    }

    if (
      Number(values.amount) > outstandingAmount
    ) {
      setValidationError(
        "Nominal pembayaran tidak boleh melebihi sisa tagihan.",
      );
      return;
    }

    if (
      selectedInvoice.invoice_date &&
      values.payment_date <
        selectedInvoice.invoice_date
    ) {
      setValidationError(
        "Tanggal pembayaran tidak boleh lebih awal dari tanggal invoice.",
      );
      return;
    }

    onSubmit({
      payment_number:
        values.payment_number
          .trim()
          .toUpperCase(),
      invoice_id: values.invoice_id,
      payment_date: values.payment_date,
      amount: Number(values.amount),
      method: values.method,
      reference_number:
        values.reference_number.trim() || null,
      notes: values.notes.trim() || null,
    });
  };

  return (
    <div
      className="purchase-order-form-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className="purchase-order-form-modal payment-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-form-title"
      >
        <header className="purchase-order-form-header">
          <div>
            <span>Finance</span>

            <h2 id="payment-form-title">
              Catat pembayaran
            </h2>
          </div>

          <button
            type="button"
            className="purchase-order-form-close"
            aria-label="Tutup form pembayaran"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="purchase-order-form"
          onSubmit={handleSubmit}
        >
          <div className="purchase-order-form-content">
            <section className="purchase-order-form-section">
              <div className="purchase-order-form-section-heading">
                <div>
                  <p>Informasi pembayaran</p>

                  <span>
                    Pembayaran hanya dapat dicatat untuk
                    invoice yang masih memiliki sisa
                    tagihan.
                  </span>
                </div>

                <WalletCards aria-hidden="true" />
              </div>

              <div className="purchase-order-form-grid">
                <label className="purchase-order-form-field">
                  <span>Nomor pembayaran</span>

                  <input
                    type="text"
                    name="payment_number"
                    value={values.payment_number}
                    placeholder="Contoh: PAY-2026-0004"
                    autoComplete="off"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <div className="purchase-order-form-field">
                  <FormSelect
                    label="Invoice"
                    value={values.invoice_id}
                    placeholder="Pilih invoice"
                    searchPlaceholder="Cari invoice atau customer..."
                    disabled={isSubmitting}
                    options={invoices.map(
                      (invoice) => ({
                        value: invoice.id,
                        label:
                          `${invoice.invoice_number} — ` +
                          `${invoice.customer_name}`,
                        searchText: [
                          invoice.invoice_number,
                          invoice.so_number,
                          invoice.customer_code,
                          invoice.customer_name,
                        ].join(" "),
                      }),
                    )}
                    onChange={handleInvoiceChange}
                  />
                </div>

                <div className="purchase-order-form-field">
                  <FormDatePicker
                    label="Tanggal pembayaran"
                    value={values.payment_date}
                    min={
                      selectedInvoice?.invoice_date ||
                      ""
                    }
                    disabled={isSubmitting}
                    onChange={handleDateChange}
                  />
                </div>

                <div className="purchase-order-form-field">
                  <FormSelect
                    label="Metode pembayaran"
                    value={values.method}
                    placeholder="Pilih metode"
                    searchable={false}
                    disabled={isSubmitting}
                    options={paymentMethodOptions}
                    onChange={handleMethodChange}
                  />
                </div>

                <label className="purchase-order-form-field">
                  <span>Nominal pembayaran</span>

                  <div className="payment-amount-input">
                    <input
                      type="number"
                      name="amount"
                      min="0.01"
                      max={
                        selectedInvoice
                          ? outstandingAmount
                          : undefined
                      }
                      step="0.01"
                      value={values.amount}
                      placeholder="0"
                      disabled={
                        isSubmitting ||
                        !selectedInvoice
                      }
                      onChange={handleFieldChange}
                    />

                    <button
                      type="button"
                      disabled={
                        isSubmitting ||
                        !selectedInvoice
                      }
                      onClick={
                        handleUseOutstandingAmount
                      }
                    >
                      Bayar penuh
                    </button>
                  </div>
                </label>

                <label className="purchase-order-form-field">
                  <span>Nomor referensi</span>

                  <input
                    type="text"
                    name="reference_number"
                    value={values.reference_number}
                    placeholder="Nomor transfer atau giro"
                    autoComplete="off"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <label className="purchase-order-form-field is-full">
                  <span>Catatan</span>

                  <textarea
                    name="notes"
                    value={values.notes}
                    rows="3"
                    placeholder="Tambahkan catatan pembayaran jika diperlukan"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            </section>

            <section className="purchase-order-form-section">
              <div className="purchase-order-form-section-heading">
                <div>
                  <p>Ringkasan invoice</p>

                  <span>
                    Periksa nilai tagihan sebelum
                    menyimpan pembayaran.
                  </span>
                </div>

                <ReceiptText aria-hidden="true" />
              </div>

              {!selectedInvoice && (
                <div className="purchase-order-form-hint">
                  Pilih invoice untuk melihat ringkasan
                  tagihan.
                </div>
              )}

              {selectedInvoice && (
                <>
                  <div className="payment-form-invoice-summary">
                    <article>
                      <span>Invoice</span>

                      <strong>
                        {selectedInvoice.invoice_number}
                      </strong>

                      <small>
                        {invoiceStatusLabels[
                          selectedInvoice.status
                        ] || selectedInvoice.status}
                      </small>
                    </article>

                    <article>
                      <span>Customer</span>

                      <strong>
                        {selectedInvoice.customer_name}
                      </strong>

                      <small>
                        {selectedInvoice.customer_code}
                      </small>
                    </article>

                    <article>
                      <span>Tanggal invoice</span>

                      <strong>
                        {formatDate(
                          selectedInvoice.invoice_date,
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>Jatuh tempo</span>

                      <strong>
                        {formatDate(
                          selectedInvoice.due_date,
                        )}
                      </strong>
                    </article>
                  </div>

                  <div className="payment-form-due-date">
                    <CalendarDays aria-hidden="true" />

                    <div>
                      <span>Sales order</span>

                      <strong>
                        {selectedInvoice.so_number}
                      </strong>
                    </div>
                  </div>

                  <div className="payment-form-calculation">
                    <div>
                      <span>Total invoice</span>

                      <strong>
                        {formatCurrency(
                          selectedInvoice.grand_total,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Sudah dibayar</span>

                      <strong>
                        {formatCurrency(
                          selectedInvoice.paid_amount,
                        )}
                      </strong>
                    </div>

                    <div className="is-outstanding">
                      <span>Sisa tagihan</span>

                      <strong>
                        {formatCurrency(
                          outstandingAmount,
                        )}
                      </strong>
                    </div>

                    <div className="is-payment">
                      <span>Pembayaran ini</span>

                      <strong>
                        {formatCurrency(paymentAmount)}
                      </strong>
                    </div>

                    <div className="is-total">
                      <span>Sisa setelah pembayaran</span>

                      <strong>
                        {formatCurrency(
                          remainingAfterPayment,
                        )}
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </section>

            {(validationError || requestError) && (
              <div
                className="purchase-order-form-error"
                role="alert"
              >
                {validationError || requestError}
              </div>
            )}
          </div>

          <footer className="purchase-order-form-actions">
            <button
              type="button"
              className="purchase-order-form-cancel"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </button>

            <button
              type="submit"
              className="purchase-order-form-submit"
              disabled={
                isSubmitting ||
                !selectedInvoice
              }
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : "Simpan pembayaran"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default PaymentFormModal;
