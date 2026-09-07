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
import CodeNumberField from "../forms/CodeNumberField";
import useCodeNumberSetting from "../../hooks/useCodeNumberSetting";

let itemSequence = 0;

const paymentSchemeOptions = [
    { value: "DIRECT", label: "Pembayaran langsung" },
    { value: "TERM", label: "Termin pembayaran" },
    { value: "DOWN_PAYMENT", label: "DP dan pelunasan" },
    { value: "COD", label: "Bayar saat barang diterima (COD)" },
];

const createEmptyItem = (product = null) => ({
    key: `purchase-order-item-${itemSequence += 1}`,
    product_id: product?.id ?? "",
    quantity: "1",
    unit_price: product?.purchase_price ?? "",
});

const createInitialValues = (supplierId = "", supplier = null, settings = {}) => ({
    po_number: "",
    supplier_id: supplierId,
    order_date: "",
    expected_date: "",
    payment_scheme:
        supplier?.payment_scheme || settings.default_purchase_scheme || "TERM",
    payment_terms_days:
        supplier?.payment_terms_days || settings.default_purchase_term_days || 0,
    down_payment_percent:
        supplier?.down_payment_percent ??
        settings.default_down_payment_percent ??
        30,
    notes: "",
});

const PurchaseOrderFormModal = ({
    isOpen,
    suppliers = [],
    products = [],
    initialSupplierId = "",
    initialProduct = null,
    paymentSettings = {},
    isLoadingProducts = false,
    isSubmitting = false,
    requestError = "",
    onClose,
    onSupplierChange,
    onSubmit,
}) => {
    const [values, setValues] = useState(
        () => createInitialValues(
            initialSupplierId,
            suppliers.find((supplier) => supplier.id === initialSupplierId),
            paymentSettings,
        ),
    );
    const [items, setItems] = useState(() => [
        createEmptyItem(initialProduct),
    ]);
    const [validationError, setValidationError] =
        useState("");
    const {
        setting: codeNumberSetting,
        isLoading: isNumberingLoading,
        errorMessage: numberingError,
    } = useCodeNumberSetting("PURCHASE_ORDER", isOpen);

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
        const supplier = suppliers.find((item) => item.id === supplierId);
        setValues((currentValues) => ({
            ...currentValues,
            supplier_id: supplierId,
            payment_scheme:
                supplier?.payment_scheme ||
                paymentSettings.default_purchase_scheme ||
                "TERM",
            payment_terms_days:
                supplier?.payment_terms_days ||
                paymentSettings.default_purchase_term_days ||
                0,
            down_payment_percent:
                supplier?.down_payment_percent ??
                paymentSettings.default_down_payment_percent ??
                30,
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
            (!codeNumberSetting?.is_automatic &&
                !values.po_number.trim()) ||
            !values.supplier_id
        ) {
            setValidationError(
                "Nomor PO manual dan supplier wajib diisi.",
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

        if (
            values.payment_scheme === "TERM" &&
            (!Number.isInteger(Number(values.payment_terms_days)) ||
                Number(values.payment_terms_days) < 0 ||
                Number(values.payment_terms_days) > 365)
        ) {
            setValidationError("Termin pembayaran harus berada di antara 0-365 hari.");
            return;
        }

        if (
            values.payment_scheme === "DOWN_PAYMENT" &&
            (!Number.isFinite(Number(values.down_payment_percent)) ||
                Number(values.down_payment_percent) < 0 ||
                Number(values.down_payment_percent) > 100)
        ) {
            setValidationError("Uang muka harus berada di antara 0-100%.");
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
            payment_scheme: values.payment_scheme,
            payment_terms_days: Number(values.payment_terms_days || 0),
            down_payment_percent: Number(values.down_payment_percent || 0),
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
                                <CodeNumberField
                                    label="Nomor PO"
                                    name="po_number"
                                    value={values.po_number}
                                    placeholder="Contoh: PO-2026-0003"
                                    maxLength={40}
                                    setting={codeNumberSetting}
                                    isLoading={isNumberingLoading}
                                    errorMessage={numberingError}
                                    disabled={isSubmitting}
                                    onChange={handleFieldChange}
                                    className="purchase-order-form-field"
                                />

                                <div className="purchase-order-form-field">
                                    <FormSelect
                                        label="Supplier"
                                        value={values.supplier_id}
                                        placeholder="Pilih supplier"
                                        disabled={isSubmitting}
                                        options={suppliers.map((supplier) => ({
                                            value: supplier.id,
                                            code: supplier.supplier_code,
                                            label: supplier.supplier_name,
                                        }))}
                                        onChange={handleSupplierChange}
                                    />
                                </div>

                                <div className="purchase-order-form-field">
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
                                </div>

                                {values.payment_scheme === "TERM" && (
                                    <label className="purchase-order-form-field">
                                        <span>Termin pembayaran (hari)</span>
                                        <input
                                            type="number"
                                            name="payment_terms_days"
                                            min="0"
                                            max="365"
                                            step="1"
                                            value={values.payment_terms_days}
                                            disabled={isSubmitting}
                                            onChange={handleFieldChange}
                                        />
                                    </label>
                                )}

                                {values.payment_scheme === "DOWN_PAYMENT" && (
                                    <label className="purchase-order-form-field">
                                        <span>Uang muka (%)</span>
                                        <input
                                            type="number"
                                            name="down_payment_percent"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={values.down_payment_percent}
                                            disabled={isSubmitting}
                                            onChange={handleFieldChange}
                                        />
                                    </label>
                                )}

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
                                                            code: product.sku,
                                                            label: product.product_name,
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
                                isNumberingLoading ||
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
