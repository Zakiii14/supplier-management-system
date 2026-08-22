import { useEffect, useState } from "react";
import {
    CalendarDays,
    Plus,
    Save,
    Trash2,
    X,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import FormDatePicker from "../forms/FormDatePicker";
import FormSelect from "../forms/FormSelect";

let itemSequence = 0;

const createEmptyItem = () => ({
    key: `purchase-order-item-${itemSequence += 1}`,
    product_id: "",
    quantity: "1",
    unit_price: "",
});

const createInitialValues = () => ({
    po_number: "",
    supplier_id: "",
    order_date: "",
    expected_date: "",
    notes: "",
});

const PurchaseOrderFormModal = ({
    isOpen,
    suppliers = [],
    products = [],
    isLoadingProducts = false,
    isSubmitting = false,
    requestError = "",
    onClose,
    onSupplierChange,
    onSubmit,
}) => {
    const [values, setValues] = useState(
        createInitialValues,
    );
    const [items, setItems] = useState(() => [
        createEmptyItem(),
    ]);
    const [validationError, setValidationError] =
        useState("");

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const previousOverflow =
            document.body.style.overflow;

        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !isSubmitting) {
                onClose();
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener(
                "keydown",
                handleKeyDown,
            );
        };
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen) {
        return null;
    }

    const handleFieldChange = (event) => {
        const { name, value } = event.target;

        setValues((currentValues) => ({
            ...currentValues,
            [name]:
                name === "po_number"
                    ? value.toUpperCase()
                    : value,
        }));

        setValidationError("");
    };

    const handleDateChange = (name, value) => {
        setValues((currentValues) => ({
            ...currentValues,
            [name]: value,
        }));

        setValidationError("");
    };

    const handleSupplierChange = (supplierId) => {
        setValues((currentValues) => ({
            ...currentValues,
            supplier_id: supplierId,
        }));
        setItems([createEmptyItem()]);
        setValidationError("");
        onSupplierChange(supplierId);
    };

    const handleItemChange = (itemKey, name, value) => {
        setItems((currentItems) =>
            currentItems.map((item) =>
                item.key === itemKey
                    ? { ...item, [name]: value }
                    : item,
            ),
        );

        setValidationError("");
    };

    const handleProductChange = (itemKey, productId) => {
        const selectedProduct = products.find(
            (product) => product.id === productId,
        );

        setItems((currentItems) =>
            currentItems.map((item) =>
                item.key === itemKey
                    ? {
                        ...item,
                        product_id: productId,
                        unit_price:
                            selectedProduct?.purchase_price ?? "",
                    }
                    : item,
            ),
        );

        setValidationError("");
    };

    const handleAddItem = () => {
        setItems((currentItems) => [
            ...currentItems,
            createEmptyItem(),
        ]);
        setValidationError("");
    };

    const handleRemoveItem = (itemKey) => {
        if (items.length === 1) {
            return;
        }

        setItems((currentItems) =>
            currentItems.filter(
                (item) => item.key !== itemKey,
            ),
        );
        setValidationError("");
    };

    const totalAmount = items.reduce(
        (total, item) =>
            total +
            (Number(item.quantity) || 0) *
            (Number(item.unit_price) || 0),
        0,
    );

    const handleSubmit = (event) => {
        event.preventDefault();

        if (
            !values.po_number.trim() ||
            !values.supplier_id
        ) {
            setValidationError(
                "Nomor PO dan supplier wajib diisi.",
            );
            return;
        }

        if (
            values.order_date &&
            values.expected_date &&
            values.expected_date < values.order_date
        ) {
            setValidationError(
                "Estimasi tiba tidak boleh lebih awal dari tanggal pesan.",
            );
            return;
        }

        const hasIncompleteItem = items.some(
            (item) =>
                !item.product_id ||
                !item.quantity ||
                Number(item.quantity) <= 0 ||
                item.unit_price === "" ||
                Number(item.unit_price) < 0,
        );

        if (hasIncompleteItem) {
            setValidationError(
                "Setiap item harus memiliki produk, jumlah lebih dari 0, dan harga yang valid.",
            );
            return;
        }

        const selectedProductIds = items.map(
            (item) => item.product_id,
        );

        if (
            new Set(selectedProductIds).size !==
            selectedProductIds.length
        ) {
            setValidationError(
                "Produk yang sama tidak boleh ditambahkan lebih dari satu kali.",
            );
            return;
        }

        onSubmit({
            po_number: values.po_number.trim().toUpperCase(),
            supplier_id: values.supplier_id,
            order_date: values.order_date || null,
            expected_date: values.expected_date || null,
            notes: values.notes.trim() || null,
            items: items.map((item) => ({
                product_id: item.product_id,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
            })),
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
                className="purchase-order-form-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="purchase-order-form-title"
            >
                <header className="purchase-order-form-header">
                    <div>
                        <span>Purchasing</span>
                        <h2 id="purchase-order-form-title">
                            Tambah purchase order
                        </h2>
                    </div>

                    <button
                        type="button"
                        className="purchase-order-form-close"
                        aria-label="Tutup form purchase order"
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
                                    <p>Informasi pesanan</p>
                                    <span>
                                        Tentukan nomor, supplier, dan jadwal PO.
                                    </span>
                                </div>

                                <CalendarDays aria-hidden="true" />
                            </div>

                            <div className="purchase-order-form-grid">
                                <label className="purchase-order-form-field">
                                    <span>Nomor PO</span>
                                    <input
                                        type="text"
                                        name="po_number"
                                        value={values.po_number}
                                        placeholder="Contoh: PO-2026-0003"
                                        autoComplete="off"
                                        disabled={isSubmitting}
                                        onChange={handleFieldChange}
                                    />
                                </label>

                                <div className="purchase-order-form-field">
                                    <FormSelect
                                        label="Supplier"
                                        value={values.supplier_id}
                                        placeholder="Pilih supplier"
                                        disabled={isSubmitting}
                                        options={suppliers.map((supplier) => ({
                                            value: supplier.id,
                                            label: `${supplier.supplier_code} — ${supplier.supplier_name}`,
                                        }))}
                                        onChange={handleSupplierChange}
                                    />
                                </div>

                                <div className="purchase-order-form-field">
                                    <FormDatePicker
                                        label="Tanggal pesan"
                                        value={values.order_date}
                                        placeholder="Pilih tanggal pesan"
                                        disabled={isSubmitting}
                                        onChange={(value) =>
                                            handleDateChange("order_date", value)
                                        }
                                    />
                                </div>

                                <div className="purchase-order-form-field">
                                    <FormDatePicker
                                        label="Estimasi tiba"
                                        value={values.expected_date}
                                        min={values.order_date}
                                        placeholder="Pilih estimasi tiba"
                                        disabled={isSubmitting}
                                        onChange={(value) =>
                                            handleDateChange("expected_date", value)
                                        }
                                    />
                                </div>

                                <label className="purchase-order-form-field is-full">
                                    <span>Catatan</span>
                                    <textarea
                                        name="notes"
                                        value={values.notes}
                                        rows="3"
                                        placeholder="Tambahkan catatan jika diperlukan"
                                        disabled={isSubmitting}
                                        onChange={handleFieldChange}
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="purchase-order-form-section">
                            <div className="purchase-order-form-items-heading">
                                <div>
                                    <p>Item produk</p>
                                    <span>
                                        Produk mengikuti supplier yang dipilih.
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    disabled={
                                        !values.supplier_id ||
                                        isLoadingProducts ||
                                        isSubmitting
                                    }
                                    onClick={handleAddItem}
                                >
                                    <Plus aria-hidden="true" />
                                    Tambah item
                                </button>
                            </div>

                            {!values.supplier_id && (
                                <div className="purchase-order-form-hint">
                                    Pilih supplier terlebih dahulu untuk melihat produk.
                                </div>
                            )}

                            {values.supplier_id && isLoadingProducts && (
                                <div className="purchase-order-form-hint">
                                    Memuat produk supplier...
                                </div>
                            )}

                            {values.supplier_id &&
                                !isLoadingProducts &&
                                products.length === 0 && (
                                    <div className="purchase-order-form-hint is-warning">
                                        Supplier ini belum memiliki produk aktif.
                                    </div>
                                )}

                            <div className="purchase-order-form-items">
                                {items.map((item, index) => {
                                    const subtotal =
                                        (Number(item.quantity) || 0) *
                                        (Number(item.unit_price) || 0);

                                    return (
                                        <article
                                            key={item.key}
                                            className="purchase-order-form-item"
                                        >
                                            <div className="purchase-order-form-item-number">
                                                <span>Item {index + 1}</span>

                                                <button
                                                    type="button"
                                                    aria-label={`Hapus item ${index + 1}`}
                                                    disabled={
                                                        items.length === 1 ||
                                                        isSubmitting
                                                    }
                                                    onClick={() =>
                                                        handleRemoveItem(item.key)
                                                    }
                                                >
                                                    <Trash2 aria-hidden="true" />
                                                </button>
                                            </div>

                                            <div className="purchase-order-form-item-grid">
                                                <div className="purchase-order-form-field is-product">
                                                    <FormSelect
                                                        label="Produk"
                                                        value={item.product_id}
                                                        placeholder={
                                                            isLoadingProducts
                                                                ? "Memuat produk..."
                                                                : "Pilih produk"
                                                        }
                                                        disabled={
                                                            !values.supplier_id ||
                                                            isLoadingProducts ||
                                                            isSubmitting
                                                        }
                                                        options={products.map((product) => ({
                                                            value: product.id,
                                                            label: `${product.sku} — ${product.product_name}`,
                                                        }))}
                                                        onChange={(productId) =>
                                                            handleProductChange(
                                                                item.key,
                                                                productId,
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <label className="purchase-order-form-field">
                                                    <span>Jumlah</span>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        min="1"
                                                        step="1"
                                                        disabled={isSubmitting}
                                                        onChange={(event) =>
                                                            handleItemChange(
                                                                item.key,
                                                                "quantity",
                                                                event.target.value,
                                                            )
                                                        }
                                                    />
                                                </label>

                                                <label className="purchase-order-form-field">
                                                    <span>Harga satuan</span>
                                                    <input
                                                        type="number"
                                                        value={item.unit_price}
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="0"
                                                        disabled={isSubmitting}
                                                        onChange={(event) =>
                                                            handleItemChange(
                                                                item.key,
                                                                "unit_price",
                                                                event.target.value,
                                                            )
                                                        }
                                                    />
                                                </label>

                                                <div className="purchase-order-form-subtotal">
                                                    <span>Subtotal</span>
                                                    <strong>
                                                        {formatCurrency(subtotal)}
                                                    </strong>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            <div className="purchase-order-form-total">
                                <span>Total purchase order</span>
                                <strong>{formatCurrency(totalAmount)}</strong>
                            </div>
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
                                isLoadingProducts ||
                                products.length === 0
                            }
                        >
                            <Save aria-hidden="true" />
                            {isSubmitting
                                ? "Menyimpan..."
                                : "Tambah purchase order"}
                        </button>
                    </footer>
                </form>
            </section>
        </div>
    );
};

export default PurchaseOrderFormModal;