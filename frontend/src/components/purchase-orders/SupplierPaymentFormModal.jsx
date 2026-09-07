import { Save, WalletCards, X } from "lucide-react";
import { useState } from "react";
import useCodeNumberSetting from "../../hooks/useCodeNumberSetting";
import { formatCurrency } from "../../utils/formatters";
import CodeNumberField from "../forms/CodeNumberField";
import FormDatePicker from "../forms/FormDatePicker";
import FormSelect from "../forms/FormSelect";
import { PaymentProofPicker } from "../payments/PaymentProofField";

const methodOptions = [
  { value: "BANK_TRANSFER", label: "Transfer bank" },
  { value: "CASH", label: "Tunai" },
  { value: "GIRO", label: "Giro" },
  { value: "OTHER", label: "Lainnya" },
];

const today = () => new Date().toISOString().slice(0, 10);

const SupplierPaymentFormModal = ({
  isOpen,
  purchaseOrder,
  requireTransferProof = false,
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState({
    payment_number: "",
    payment_date: today(),
    amount: "",
    method: "BANK_TRANSFER",
    reference_number: "",
    supplier_invoice_number: "",
    notes: "",
  });
  const [proofs, setProofs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const {
    setting,
    isLoading: isNumberingLoading,
    errorMessage: numberingError,
  } = useCodeNumberSetting("SUPPLIER_PAYMENT", isOpen);

  if (!isOpen) return null;

  const outstanding = Number(purchaseOrder.outstanding_amount) || 0;
  const invoiceOptions = (purchaseOrder.supplier_invoices || [])
    .filter((invoice) => Number(invoice.outstanding_amount) > 0)
    .map((invoice) => ({
      value: invoice.invoice_number,
      label: `${invoice.invoice_number} · sisa ${formatCurrency(invoice.outstanding_amount)}`,
    }));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({
      ...current,
      [name]: name === "payment_number" ? value.toUpperCase() : value,
    }));
    setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(values.amount);
    if ((!setting?.is_automatic && !values.payment_number.trim()) || !values.payment_date) {
      setErrorMessage("Nomor pembayaran manual dan tanggal wajib diisi.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) {
      setErrorMessage("Nominal harus lebih dari nol dan tidak melebihi sisa tagihan.");
      return;
    }
    if (
      requireTransferProof &&
      ["BANK_TRANSFER", "GIRO"].includes(values.method) &&
      proofs.length === 0
    ) {
      setErrorMessage("Bukti pembayaran wajib untuk transfer bank atau giro.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await onSubmit({
        payment_number: values.payment_number.trim().toUpperCase(),
        payment_date: values.payment_date,
        amount,
        method: values.method,
        reference_number: values.reference_number.trim() || null,
        supplier_invoice_number:
          values.supplier_invoice_number.trim() || null,
        notes: values.notes.trim() || null,
        proofs,
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Pembayaran supplier gagal disimpan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="purchase-order-form-backdrop supplier-payment-backdrop">
      <section
        className="purchase-order-form-modal supplier-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-payment-title"
      >
        <header className="purchase-order-form-header">
          <div>
            <span>Finance · {purchaseOrder.po_number}</span>
            <h2 id="supplier-payment-title">Catat pembayaran supplier</h2>
          </div>
          <button
            type="button"
            className="purchase-order-form-close"
            aria-label="Tutup form pembayaran supplier"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form className="purchase-order-form" onSubmit={handleSubmit}>
          <div className="purchase-order-form-content">
            <section className="supplier-payment-summary">
              <WalletCards aria-hidden="true" />
              <div>
                <span>Sisa pembayaran kepada {purchaseOrder.supplier_name}</span>
                <strong>{formatCurrency(outstanding)}</strong>
              </div>
              <button
                type="button"
                onClick={() =>
                  setValues((current) => ({ ...current, amount: String(outstanding) }))
                }
              >
                Bayar penuh
              </button>
            </section>

            <section className="purchase-order-form-section">
              <div className="purchase-order-form-grid">
                <CodeNumberField
                  label="Nomor pembayaran"
                  name="payment_number"
                  value={values.payment_number}
                  maxLength={40}
                  setting={setting}
                  isLoading={isNumberingLoading}
                  errorMessage={numberingError}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
                <div className="purchase-order-form-field">
                  <FormDatePicker
                    label="Tanggal pembayaran"
                    value={values.payment_date}
                    min={purchaseOrder.order_date}
                    disabled={isSubmitting}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, payment_date: value }))
                    }
                  />
                </div>
                <div className="purchase-order-form-field">
                  <FormSelect
                    label="Metode"
                    value={values.method}
                    options={methodOptions}
                    searchable={false}
                    disabled={isSubmitting}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, method: value }))
                    }
                  />
                </div>
                <label className="purchase-order-form-field">
                  <span>Nominal</span>
                  <input
                    type="number"
                    name="amount"
                    min="0.01"
                    max={outstanding}
                    step="0.01"
                    value={values.amount}
                    disabled={isSubmitting}
                    onChange={handleChange}
                  />
                </label>
                <label className="purchase-order-form-field">
                  <span>Nomor referensi</span>
                  <input
                    name="reference_number"
                    value={values.reference_number}
                    placeholder="Nomor transfer atau giro"
                    disabled={isSubmitting}
                    onChange={handleChange}
                  />
                </label>
                <div className="purchase-order-form-field">
                  <FormSelect
                    label="Invoice supplier"
                    value={values.supplier_invoice_number}
                    options={invoiceOptions}
                    placeholder="Pilih invoice terdaftar"
                    searchable={false}
                    disabled={isSubmitting || invoiceOptions.length === 0}
                    onChange={(value) => {
                      const invoice = (purchaseOrder.supplier_invoices || []).find(
                        (item) => item.invoice_number === value,
                      );
                      setValues((current) => ({
                        ...current,
                        supplier_invoice_number: value,
                        amount: invoice ? String(invoice.outstanding_amount) : current.amount,
                      }));
                    }}
                  />
                  {invoiceOptions.length === 0 && <small>Buat tagihan supplier terlebih dahulu.</small>}
                </div>
                <label className="purchase-order-form-field is-full">
                  <span>Catatan</span>
                  <textarea
                    name="notes"
                    rows="3"
                    value={values.notes}
                    disabled={isSubmitting}
                    onChange={handleChange}
                  />
                </label>
                <div className="purchase-order-form-field is-full">
                  <PaymentProofPicker
                    files={proofs}
                    onChange={setProofs}
                    disabled={isSubmitting}
                    required={
                      requireTransferProof &&
                      ["BANK_TRANSFER", "GIRO"].includes(values.method)
                    }
                  />
                </div>
              </div>
            </section>

            {errorMessage && <div className="purchase-order-form-error">{errorMessage}</div>}
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
              disabled={isSubmitting || isNumberingLoading}
            >
              <Save aria-hidden="true" />
              {isSubmitting ? "Menyimpan..." : "Simpan pembayaran"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default SupplierPaymentFormModal;
