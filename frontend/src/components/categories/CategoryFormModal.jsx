import { useEffect, useState } from "react";
import { Tags, X } from "lucide-react";

const CategoryFormModal = ({
  isOpen,
  mode = "create",
  category = null,
  isSubmitting = false,
  requestError = "",
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    category_code: category?.category_code || "",
    category_name: category?.category_name || "",
  });

  const isEditing = mode === "edit";

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

    setFormData((current) => ({
      ...current,
      [name]:
        name === "category_code"
          ? value.toUpperCase()
          : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      category_code:
        formData.category_code.trim().toUpperCase(),
      category_name:
        formData.category_name.trim(),
    });
  };

  const isFormIncomplete =
    !formData.category_code.trim() ||
    !formData.category_name.trim();

  return (
    <div
      className="category-form-backdrop"
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
        className="category-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-form-title"
      >
        <header className="category-form-header">
          <div className="category-form-heading">
            <span className="category-form-icon">
              <Tags aria-hidden="true" />
            </span>

            <div>
              <p>Master Data</p>
              <h2 id="category-form-title">
                {isEditing
                  ? "Edit kategori"
                  : "Tambah kategori"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="category-form-close"
            aria-label="Tutup formulir"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="category-form"
          onSubmit={handleSubmit}
        >
          <div className="category-form-body">
            <p className="category-form-description">
              {isEditing
                ? "Perbarui kode atau nama kategori yang dipilih."
                : "Tambahkan kategori untuk mengelompokkan produk."}
            </p>

            {requestError && (
              <div
                className="category-form-error"
                role="alert"
              >
                {requestError}
              </div>
            )}

            <div className="category-form-grid">
              <label className="category-form-field">
                <span>
                  Kode kategori
                  <strong aria-hidden="true">*</strong>
                </span>

                <input
                  type="text"
                  name="category_code"
                  value={formData.category_code}
                  maxLength={50}
                  autoComplete="off"
                  placeholder="Contoh: CAT-001"
                  disabled={isSubmitting}
                  onChange={handleChange}
                  required
                />

                <small>
                  Kode otomatis disimpan menggunakan
                  huruf kapital.
                </small>
              </label>

              <label className="category-form-field">
                <span>
                  Nama kategori
                  <strong aria-hidden="true">*</strong>
                </span>

                <input
                  type="text"
                  name="category_name"
                  value={formData.category_name}
                  maxLength={100}
                  autoComplete="off"
                  placeholder="Contoh: Pembersih Lantai"
                  disabled={isSubmitting}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>
          </div>

          <footer className="category-form-actions">
            <button
              type="button"
              className="category-form-cancel"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </button>

            <button
              type="submit"
              className="category-form-submit"
              disabled={
                isSubmitting || isFormIncomplete
              }
            >
              {isSubmitting
                ? "Menyimpan..."
                : isEditing
                  ? "Simpan perubahan"
                  : "Tambah kategori"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default CategoryFormModal;