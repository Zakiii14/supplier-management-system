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
  key: `sales-order-item-${itemSequence += 1}`,
  product_id: "",
  quantity: "1",
  unit_price: "",
  discount_amount: "0",
});

const createInitialValues = () => ({
  so_number: "",
  customer_id: "",
  order_date: "",
  requested_delivery_date: "",
  notes: "",
});

const SalesOrderFormModal = ({
  isOpen,
  customers = [],
  products = [],
  isSubmitting = false,
  requestError = "",
  onClose,
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

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setValues((currentValues) => ({
      ...currentValues,
      [name]:
        name === "so_number"
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

  const handleItemChange = (
    itemKey,
    name,
    value,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.key === itemKey
          ? {
              ...item,
              [name]: value,
            }
          : item,
      ),
    );

    setValidationError("");
  };

  const handleProductChange = (
    itemKey,
    productId,
  ) => {
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
                selectedProduct?.selling_price ?? "",
              discount_amount: "0",
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

  const calculateSubtotal = (item) => {
    const grossAmount =
      (Number(item.quantity) || 0) *
      (Number(item.unit_price) || 0);

    return Math.max(
      grossAmount -
        (Number(item.discount_amount) || 0),
      0,
    );
  };

  const totalAmount = items.reduce(
    (total, item) =>
      total + calculateSubtotal(item),
    0,
  );

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !values.so_number.trim() ||
      !values.customer_id
    ) {
      setValidationError(
        "Nomor SO dan customer wajib diisi.",
      );
      return;
    }

    if (
      values.order_date &&
      values.requested_delivery_date &&
      values.requested_delivery_date <
        values.order_date
    ) {
      setValidationError(
        "Tanggal pengiriman tidak boleh lebih awal dari tanggal pesanan.",
      );
      return;
    }

    const hasInvalidItem = items.some((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const discountAmount = Number(
        item.discount_amount,
      );

      return (
        !item.product_id ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        item.unit_price === "" ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        item.discount_amount === "" ||
        !Number.isFinite(discountAmount) ||
        discountAmount < 0
      );
    });

    if (hasInvalidItem) {
      setValidationError(
        "Setiap item harus memiliki produk, jumlah bulat lebih dari 0, harga, dan diskon yang valid.",
      );
      return;
    }

    const hasExcessiveDiscount = items.some(
      (item) =>
        Number(item.discount_amount) >
        Number(item.quantity) *
          Number(item.unit_price),
    );

    if (hasExcessiveDiscount) {
      setValidationError(
        "Diskon tidak boleh melebihi nilai kotor item.",
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
      so_number: values.so_number
        .trim()
        .toUpperCase(),
      customer_id: values.customer_id,
      order_date: values.order_date || null,
      requested_delivery_date:
        values.requested_delivery_date || null,
      notes: values.notes.trim() || null,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_amount: Number(
          item.discount_amount,
        ),
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
        aria-labelledby="sales-order-form-title"
      >
        <header className="purchase-order-form-header">
          <div>
            <span>Sales &amp; Delivery</span>
            <h2 id="sales-order-form-title">
              Tambah sales order
            </h2>
          </div>

          <button
            type="button"
            className="purchase-order-form-close"
            aria-label="Tutup form sales order"
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
                    Tentukan nomor, customer, dan jadwal
                    pengiriman.
                  </span>
                </div>

                <CalendarDays aria-hidden="true" />
              </div>

              <div className="purchase-order-form-grid">
                <label className="purchase-order-form-field">
                  <span>Nomor SO</span>
                  <input
                    type="text"
                    name="so_number"
                    value={values.so_number}
                    placeholder="Contoh: SO-2026-0003"
                    autoComplete="off"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <div className="purchase-order-form-field">
                  <FormSelect
                    label="Customer"
                    value={values.customer_id}
                    placeholder="Pilih customer"
                    disabled={isSubmitting}
                    options={customers.map(
                      (customer) => ({
                        value: customer.id,
                        label: `${customer.customer_code} — ${customer.customer_name}`,
                      }),
                    )}
                    onChange={(customerId) => {
                      setValues((currentValues) => ({
                        ...currentValues,
                        customer_id: customerId,
                      }));

                      setValidationError("");
                    }}
                  />
                </div>

                <div className="purchase-order-form-field">
                  <FormDatePicker
                    label="Tanggal pesanan"
                    value={values.order_date}
                    placeholder="Pilih tanggal pesanan"
                    disabled={isSubmitting}
                    onChange={(value) =>
                      handleDateChange(
                        "order_date",
                        value,
                      )
                    }
                  />
                </div>

                <div className="purchase-order-form-field">
                  <FormDatePicker
                    label="Tanggal pengiriman"
                    value={
                      values.requested_delivery_date
                    }
                    min={values.order_date}
                    placeholder="Pilih tanggal pengiriman"
                    disabled={isSubmitting}
                    onChange={(value) =>
                      handleDateChange(
                        "requested_delivery_date",
                        value,
                      )
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
                    Harga awal mengikuti harga jual produk.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={
                    products.length === 0 ||
                    isSubmitting
                  }
                  onClick={handleAddItem}
                >
                  <Plus aria-hidden="true" />
                  Tambah item
                </button>
              </div>

              {products.length === 0 && (
                <div className="purchase-order-form-hint is-warning">
                  Belum ada produk aktif yang dapat
                  ditambahkan.
                </div>
              )}

              <div className="purchase-order-form-items">
                {items.map((item, index) => {
                  const subtotal =
                    calculateSubtotal(item);

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

                      <div className="purchase-order-form-item-grid sales-order-form-item-grid">
                        <div className="purchase-order-form-field is-product">
                          <FormSelect
                            label="Produk"
                            value={item.product_id}
                            placeholder="Pilih produk"
                            disabled={
                              products.length === 0 ||
                              isSubmitting
                            }
                            options={products.map(
                              (product) => ({
                                value: product.id,
                                label:
                                  `${product.sku} — ` +
                                  `${product.product_name} ` +
                                  `(Stok: ${product.current_stock} ${product.unit})`,
                              }),
                            )}
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
                            step="1"
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

                        <label className="purchase-order-form-field">
                          <span>Diskon</span>
                          <input
                            type="number"
                            value={item.discount_amount}
                            min="0"
                            step="1"
                            disabled={isSubmitting}
                            onChange={(event) =>
                              handleItemChange(
                                item.key,
                                "discount_amount",
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
                <span>Total sales order</span>
                <strong>
                  {formatCurrency(totalAmount)}
                </strong>
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
                products.length === 0
              }
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : "Tambah sales order"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default SalesOrderFormModal;