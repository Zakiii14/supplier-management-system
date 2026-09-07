import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import useCodeNumberSetting from "../../hooks/useCodeNumberSetting";
import CodeNumberField from "../forms/CodeNumberField";
import FormSelect from "../forms/FormSelect";

const paymentSchemeOptions = [
  { value: "", label: "Ikuti pengaturan global" },
  { value: "DIRECT", label: "Pembayaran langsung" },
  { value: "TERM", label: "Termin pembayaran" },
  { value: "DOWN_PAYMENT", label: "DP dan pelunasan" },
  { value: "COD", label: "Bayar saat barang diterima (COD)" },
];

const emptyValues = {
  supplier_code: "",
  supplier_name: "",
  contact_person: "",
  phone: "",
  email: "",
  city: "",
  payment_terms_days: "",
  payment_scheme: "",
  down_payment_percent: "",
  address: "",
  notes: "",
};

const createInitialValues = (supplier) => {
  if (!supplier) {
    return emptyValues;
  }

  return {
    supplier_code: supplier.supplier_code ?? "",
    supplier_name: supplier.supplier_name ?? "",
    contact_person: supplier.contact_person ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    city: supplier.city ?? "",
    payment_terms_days:
      supplier.payment_terms_days ?? "",
    payment_scheme: supplier.payment_scheme ?? "",
    down_payment_percent:
      supplier.down_payment_percent ?? "",
    address: supplier.address ?? "",
    notes: supplier.notes ?? "",
  };
};

const SupplierFormModal = ({
  isOpen,
  mode = "create",
  supplier = null,
  isSubmitting = false,
  requestError = "",
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState(() =>
    createInitialValues(supplier),
  );

  const [validationError, setValidationError] =
    useState("");
  const {
    setting: codeNumberSetting,
    isLoading: isNumberingLoading,
    errorMessage: numberingError,
  } = useCodeNumberSetting("SUPPLIER", isOpen);

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

  const handleChange = (event) => {
    const { name, value } = event.target;

    const normalizedValue =
      name === "supplier_code"
        ? value.toUpperCase()
        : value;

    setValues((currentValues) => ({
      ...currentValues,
      [name]: normalizedValue,
    }));

    setValidationError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      (!codeNumberSetting?.is_automatic &&
        !values.supplier_code.trim()) ||
      !values.supplier_name.trim()
    ) {
      setValidationError(
        "Kode manual dan nama supplier wajib diisi.",
      );
      return;
    }

    const paymentTerms = Number(
      values.payment_terms_days || 0,
    );

    if (
      paymentTerms < 0 ||
      !Number.isInteger(paymentTerms)
    ) {
      setValidationError(
        "Termin pembayaran harus berupa bilangan bulat dan tidak boleh negatif.",
      );
      return;
    }

    const downPayment =
      values.down_payment_percent === ""
        ? null
        : Number(values.down_payment_percent);

    if (
      downPayment !== null &&
      (!Number.isFinite(downPayment) || downPayment < 0 || downPayment > 100)
    ) {
      setValidationError("DP supplier harus berada di antara 0-100%.");
      return;
    }

    onSubmit({
      supplier_code:
        values.supplier_code
          .trim()
          .toUpperCase(),
      supplier_name: values.supplier_name.trim(),
      contact_person:
        values.contact_person.trim() || null,
      phone: values.phone.trim() || null,
      email:
        values.email.trim().toLowerCase() || null,
      city: values.city.trim() || null,
      payment_terms_days: paymentTerms,
      payment_scheme: values.payment_scheme || null,
      down_payment_percent:
        downPayment,
      address: values.address.trim() || null,
      notes: values.notes.trim() || null,
    });
  };

  const title =
    mode === "edit"
      ? "Edit supplier"
      : "Tambah supplier";

  return (
    <div
      className="product-modal-backdrop"
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
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-form-title"
      >
        <header className="product-modal-header">
          <div>
            <span className="product-modal-eyebrow">
              Master Data
            </span>
            <h2 id="supplier-form-title">
              {title}
            </h2>
          </div>

          <button
            type="button"
            className="product-modal-close"
            aria-label="Tutup form supplier"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="product-form"
          onSubmit={handleSubmit}
        >
          <div className="product-form-grid">
            <CodeNumberField
              label="Kode supplier"
              name="supplier_code"
              value={values.supplier_code}
              placeholder="Contoh: SUP-0001"
              maxLength={30}
              mode={mode}
              setting={codeNumberSetting}
              isLoading={isNumberingLoading}
              errorMessage={numberingError}
              disabled={isSubmitting}
              onChange={handleChange}
            />

            <label className="product-form-field">
              <span>Nama supplier</span>
              <input
                type="text"
                name="supplier_name"
                value={values.supplier_name}
                placeholder="Masukkan nama supplier"
                autoComplete="organization"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Contact person</span>
              <input
                type="text"
                name="contact_person"
                value={values.contact_person}
                placeholder="Nama contact person"
                autoComplete="name"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Nomor telepon</span>
              <input
                type="tel"
                name="phone"
                value={values.phone}
                placeholder="Contoh: 081234567890"
                autoComplete="tel"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={values.email}
                placeholder="supplier@contoh.com"
                autoComplete="email"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Kota</span>
              <input
                type="text"
                name="city"
                value={values.city}
                placeholder="Masukkan kota"
                autoComplete="address-level2"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Termin pembayaran (hari)</span>
              <input
                type="number"
                name="payment_terms_days"
                value={values.payment_terms_days}
                min="0"
                step="1"
                placeholder="0"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <FormSelect
              label="Skema pembayaran"
              value={values.payment_scheme}
              options={paymentSchemeOptions}
              searchable={false}
              disabled={isSubmitting}
              onChange={(paymentScheme) =>
                setValues((current) => ({
                  ...current,
                  payment_scheme: paymentScheme,
                }))
              }
            />

            <label className="product-form-field">
              <span>DP khusus supplier (%)</span>
              <input
                type="number"
                name="down_payment_percent"
                value={values.down_payment_percent}
                min="0"
                max="100"
                step="0.01"
                placeholder="Ikuti pengaturan global"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field product-form-field-full">
              <span>Alamat</span>
              <textarea
                name="address"
                value={values.address}
                rows="3"
                placeholder="Masukkan alamat supplier"
                autoComplete="street-address"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field product-form-field-full">
              <span>Catatan</span>
              <textarea
                name="notes"
                value={values.notes}
                rows="3"
                placeholder="Tambahkan catatan jika diperlukan"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>
          </div>

          {(validationError || requestError) && (
            <div
              className="product-form-error"
              role="alert"
            >
              {validationError || requestError}
            </div>
          )}

          <footer className="product-form-actions">
            <button
              type="button"
              className="product-form-cancel"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </button>

            <button
              type="submit"
              className="product-form-submit"
              disabled={isSubmitting || isNumberingLoading}
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : mode === "edit"
                  ? "Simpan perubahan"
                  : "Tambah supplier"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default SupplierFormModal;
