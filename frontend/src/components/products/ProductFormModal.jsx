import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import FormSelect from "../forms/FormSelect";

const emptyValues = {
  sku: "",
  product_name: "",
  category_id: "",
  supplier_id: "",
  unit: "PCS",
  purchase_price: "",
  selling_price: "",
  minimum_stock: "",
  description: "",
};

const createInitialValues = (product) => {
  if (!product) {
    return emptyValues;
  }

  return {
    sku: product.sku ?? "",
    product_name: product.product_name ?? "",
    category_id: product.category_id ?? "",
    supplier_id: product.supplier_id ?? "",
    unit: product.unit ?? "PCS",
    purchase_price: product.purchase_price ?? "",
    selling_price: product.selling_price ?? "",
    minimum_stock: product.minimum_stock ?? "",
    description: product.description ?? "",
  };
};

const ProductFormModal = ({
  isOpen,
  mode = "create",
  product = null,
  categories = [],
  suppliers = [],
  isSubmitting = false,
  requestError = "",
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState(() =>
    createInitialValues(product),
  );
  const [validationError, setValidationError] =
    useState("");

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;

    const normalizedValue =
      name === "sku" ? value.toUpperCase() : value;

    setValues((currentValues) => ({
      ...currentValues,
      [name]: normalizedValue,
    }));

    setValidationError("");
  };

  const handleSelectChange = (name, value) => {
    setValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));

    setValidationError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !values.sku.trim() ||
      !values.product_name.trim() ||
      !values.category_id ||
      !values.supplier_id
    ) {
      setValidationError(
        "SKU, nama produk, kategori, dan supplier wajib diisi.",
      );
      return;
    }

    const purchasePrice = Number(values.purchase_price || 0);
    const sellingPrice = Number(values.selling_price || 0);
    const minimumStock = Number(values.minimum_stock || 0);

    if (
      purchasePrice < 0 ||
      sellingPrice < 0 ||
      minimumStock < 0
    ) {
      setValidationError(
        "Harga dan minimum stok tidak boleh bernilai negatif.",
      );
      return;
    }

    onSubmit({
      sku: values.sku.trim().toUpperCase(),
      product_name: values.product_name.trim(),
      category_id: values.category_id,
      supplier_id: values.supplier_id,
      unit: values.unit.trim() || "PCS",
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      minimum_stock: minimumStock,
      description: values.description.trim() || null,
    });
  };

  const title =
    mode === "edit" ? "Edit produk" : "Tambah produk";

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
        aria-labelledby="product-form-title"
      >
        <header className="product-modal-header">
          <div>
            <span className="product-modal-eyebrow">
              Master Data
            </span>
            <h2 id="product-form-title">{title}</h2>
          </div>

          <button
            type="button"
            className="product-modal-close"
            aria-label="Tutup form produk"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>

        <form
          className="product-form"
          onSubmit={handleSubmit}
        >
          <div className="product-form-grid">
            <label className="product-form-field">
              <span>SKU</span>
              <input
                type="text"
                name="sku"
                value={values.sku}
                placeholder="Contoh: SKU-D001"
                autoComplete="off"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Nama produk</span>
              <input
                type="text"
                name="product_name"
                value={values.product_name}
                placeholder="Masukkan nama produk"
                autoComplete="off"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <div className="product-form-field">
              <FormSelect
                label="Kategori"
                value={values.category_id}
                placeholder="Pilih kategori"
                disabled={isSubmitting}
                options={categories.map((category) => ({
                  value: category.id,
                  label: category.category_name,
                }))}
                onChange={(value) =>
                  handleSelectChange("category_id", value)
                }
              />
            </div>

            <div className="product-form-field">
              <FormSelect
                label="Supplier"
                value={values.supplier_id}
                placeholder="Pilih supplier"
                disabled={isSubmitting}
                options={suppliers.map((supplier) => ({
                  value: supplier.id,
                  label: supplier.supplier_name,
                }))}
                onChange={(value) =>
                  handleSelectChange("supplier_id", value)
                }
              />
            </div>

            <label className="product-form-field">
              <span>Satuan</span>
              <input
                type="text"
                name="unit"
                value={values.unit}
                placeholder="Contoh: PCS"
                autoComplete="off"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Minimum stok</span>
              <input
                type="number"
                name="minimum_stock"
                value={values.minimum_stock}
                min="0"
                step="1"
                placeholder="0"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Harga beli</span>
              <input
                type="number"
                name="purchase_price"
                value={values.purchase_price}
                min="0"
                step="0.01"
                placeholder="0"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field">
              <span>Harga jual</span>
              <input
                type="number"
                name="selling_price"
                value={values.selling_price}
                min="0"
                step="0.01"
                placeholder="0"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>

            <label className="product-form-field product-form-field-full">
              <span>Deskripsi</span>
              <textarea
                name="description"
                value={values.description}
                rows="4"
                placeholder="Tambahkan deskripsi produk jika diperlukan"
                disabled={isSubmitting}
                onChange={handleChange}
              />
            </label>
          </div>

          {(validationError || requestError) && (
            <div className="product-form-error" role="alert">
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
              <Save size={18} />
              {isSubmitting
                ? "Menyimpan..."
                : mode === "edit"
                  ? "Simpan perubahan"
                  : "Tambah produk"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default ProductFormModal;