import {
  Calculator,
  CalendarDays,
  ReceiptText,
  Save,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../../utils/formatters";
import FormDatePicker from "../forms/FormDatePicker";
import FormSelect from "../forms/FormSelect";

const getTodayValue = () =>
  new Date().toISOString().slice(0, 10);

const createInitialValues = () => ({
  invoice_number: "",
  sales_order_id: "",
  invoice_date: getTodayValue(),
  tax_amount: "0",
  notes: "",
});

const calculateDueDate = (
  invoiceDate,
  paymentTermsDays,
) => {
  if (!invoiceDate) {
    return "";
  }

  const date = new Date(
    `${invoiceDate}T00:00:00Z`,
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(
    date.getUTCDate() +
      Number(paymentTermsDays || 0),
  );

  return date.toISOString().slice(0, 10);
};

const InvoiceFormModal = ({
  isOpen,
  salesOrders = [],
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

  const selectedSalesOrder =
    salesOrders.find(
      (salesOrder) =>
        salesOrder.id ===
        values.sales_order_id,
    ) || null;

  const subtotal = Number(
    selectedSalesOrder?.subtotal || 0,
  );

  const discountAmount = Number(
    selectedSalesOrder?.discount_amount || 0,
  );

  const totalAfterDiscount = Number(
    selectedSalesOrder?.total_amount || 0,
  );

  const taxAmount =
    Number(values.tax_amount) || 0;

  const grandTotal =
    totalAfterDiscount + taxAmount;

  const dueDate = selectedSalesOrder
    ? calculateDueDate(
        values.invoice_date,
        selectedSalesOrder
          .payment_terms_days,
      )
    : "";

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setValues((currentValues) => ({
      ...currentValues,
      [name]:
        name === "invoice_number"
          ? value.toUpperCase()
          : value,
    }));

    setValidationError("");
  };

  const handleSalesOrderChange = (
    salesOrderId,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      sales_order_id: salesOrderId,
    }));

    setValidationError("");
  };

  const handleDateChange = (value) => {
    setValues((currentValues) => ({
      ...currentValues,
      invoice_date: value,
    }));

    setValidationError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !values.invoice_number.trim() ||
      !values.sales_order_id
    ) {
      setValidationError(
        "Nomor invoice dan sales order wajib diisi.",
      );
      return;
    }

    if (!values.invoice_date) {
      setValidationError(
        "Tanggal invoice wajib diisi.",
      );
      return;
    }

    if (
      !Number.isFinite(
        Number(values.tax_amount),
      ) ||
      Number(values.tax_amount) < 0
    ) {
      setValidationError(
        "Nilai pajak tidak boleh negatif.",
      );
      return;
    }

    onSubmit({
      invoice_number:
        values.invoice_number
          .trim()
          .toUpperCase(),
      sales_order_id: values.sales_order_id,
      invoice_date: values.invoice_date,
      tax_amount: Number(values.tax_amount),
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
        className="purchase-order-form-modal invoice-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-form-title"
      >
        <header className="purchase-order-form-header">
          <div>
            <span>Finance</span>

            <h2 id="invoice-form-title">
              Tambah invoice
            </h2>
          </div>

          <button
            type="button"
            className="purchase-order-form-close"
            aria-label="Tutup form invoice"
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
                  <p>Informasi invoice</p>

                  <span>
                    Invoice hanya dapat dibuat dari
                    sales order yang telah selesai
                    dikirim.
                  </span>
                </div>

                <ReceiptText aria-hidden="true" />
              </div>

              <div className="purchase-order-form-grid">
                <label className="purchase-order-form-field">
                  <span>Nomor invoice</span>

                  <input
                    type="text"
                    name="invoice_number"
                    value={values.invoice_number}
                    placeholder="Contoh: INV-2026-0003"
                    autoComplete="off"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <div className="purchase-order-form-field">
                  <FormSelect
                    label="Sales order"
                    value={values.sales_order_id}
                    placeholder="Pilih sales order"
                    disabled={isSubmitting}
                    options={salesOrders.map(
                      (salesOrder) => ({
                        value: salesOrder.id,
                        label:
                          `${salesOrder.so_number} — ` +
                          `${salesOrder.customer_name}`,
                      }),
                    )}
                    onChange={
                      handleSalesOrderChange
                    }
                  />
                </div>

                <div className="purchase-order-form-field">
                  <FormDatePicker
                    label="Tanggal invoice"
                    value={values.invoice_date}
                    disabled={isSubmitting}
                    onChange={handleDateChange}
                  />
                </div>

                <label className="purchase-order-form-field">
                  <span>Pajak</span>

                  <input
                    type="number"
                    name="tax_amount"
                    min="0"
                    step="1"
                    value={values.tax_amount}
                    placeholder="0"
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
                    placeholder="Tambahkan catatan invoice jika diperlukan"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            </section>

            <section className="purchase-order-form-section">
              <div className="purchase-order-form-section-heading">
                <div>
                  <p>Ringkasan tagihan</p>

                  <span>
                    Nilai invoice dihitung dari sales
                    order dan pajak yang dimasukkan.
                  </span>
                </div>

                <Calculator aria-hidden="true" />
              </div>

              {!selectedSalesOrder && (
                <div className="purchase-order-form-hint">
                  Pilih sales order untuk melihat
                  perhitungan invoice.
                </div>
              )}

              {selectedSalesOrder && (
                <>
                  <div className="invoice-form-order-summary">
                    <article>
                      <span>Sales order</span>

                      <strong>
                        {
                          selectedSalesOrder
                            .so_number
                        }
                      </strong>
                    </article>

                    <article>
                      <span>Customer</span>

                      <strong>
                        {
                          selectedSalesOrder
                            .customer_name
                        }
                      </strong>

                      <small>
                        {
                          selectedSalesOrder
                            .customer_code
                        }
                      </small>
                    </article>

                    <article>
                      <span>Jumlah produk</span>

                      <strong>
                        {formatNumber(
                          selectedSalesOrder
                            .total_items,
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>Termin pembayaran</span>

                      <strong>
                        {formatNumber(
                          selectedSalesOrder
                            .payment_terms_days,
                        )}{" "}
                        hari
                      </strong>
                    </article>
                  </div>

                  <div className="invoice-form-due-date">
                    <CalendarDays aria-hidden="true" />

                    <div>
                      <span>Jatuh tempo</span>

                      <strong>
                        {formatDate(dueDate)}
                      </strong>
                    </div>
                  </div>

                  <div className="invoice-form-calculation">
                    <div>
                      <span>Subtotal</span>

                      <strong>
                        {formatCurrency(subtotal)}
                      </strong>
                    </div>

                    <div>
                      <span>Diskon</span>

                      <strong>
                        -{" "}
                        {formatCurrency(
                          discountAmount,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Setelah diskon</span>

                      <strong>
                        {formatCurrency(
                          totalAfterDiscount,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Pajak</span>

                      <strong>
                        {formatCurrency(taxAmount)}
                      </strong>
                    </div>

                    <div className="is-total">
                      <span>Grand total</span>

                      <strong>
                        {formatCurrency(grandTotal)}
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
                !selectedSalesOrder
              }
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : "Simpan invoice"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default InvoiceFormModal;