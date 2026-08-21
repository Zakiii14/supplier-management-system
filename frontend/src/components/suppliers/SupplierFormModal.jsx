import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";

const emptyValues = {
  supplier_code: "",
  supplier_name: "",
  contact_person: "",
  phone: "",
  email: "",
  city: "",
  payment_terms_days: "",
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
      !values.supplier_code.trim() ||
      !values.supplier_name.trim()
    ) {
      setValidationError(
        "Kode dan nama supplier wajib diisi.",
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
            <label className="product-form-field">
              <span>Kode supplier</span>
              <input
                type="text"
                name="supplier_code"
                value={values.supplier_code}
                placeholder="Contoh: SUP-001"
                autoComplete="off"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

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
              disabled={isSubmitting}
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