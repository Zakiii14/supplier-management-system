import {
  PackageCheck,
  Save,
  Truck,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { formatNumber } from "../../utils/formatters";
import FormDatePicker from "../forms/FormDatePicker";
import FormSelect from "../forms/FormSelect";

const getTodayValue = () =>
  new Date().toISOString().slice(0, 10);

const createInitialValues = () => ({
  delivery_number: "",
  sales_order_id: "",
  delivery_date: getTodayValue(),
  recipient_name: "",
  address: "",
  notes: "",
});

const createDeliveryItems = (salesOrder) =>
  (salesOrder?.items || [])
    .map((item) => ({
      sales_order_item_id: item.id,
      product_id: item.product_id,
      sku: item.sku,
      product_name: item.product_name,
      unit: item.unit,
      product_status: item.product_status,
      ordered_quantity: Number(item.quantity),
      reserved_quantity: Number(
        item.reserved_quantity,
      ),
      remaining_quantity: Number(
        item.remaining_quantity,
      ),
      current_stock: Number(item.current_stock),
      quantity_delivered: "0",
    }))
    .filter(
      (item) => item.remaining_quantity > 0,
    );

const statusLabels = {
  CONFIRMED: "Dikonfirmasi",
  PARTIALLY_DELIVERED: "Dikirim sebagian",
};

const DeliveryFormModal = ({
  isOpen,
  salesOrders = [],
  selectedSalesOrder = null,
  isLoadingSalesOrder = false,
  isSubmitting = false,
  requestError = "",
  onClose,
  onSalesOrderChange,
  onSubmit,
}) => {
  const requestIdRef = useRef(0);

  const [values, setValues] = useState(
    createInitialValues,
  );

  const [items, setItems] = useState([]);
  const [validationError, setValidationError] =
    useState("");

//   useEffect(() => {
//     if (!isOpen) {
//       return;
//     }

//     requestIdRef.current += 1;
//     setValues(createInitialValues());
//     setItems([]);
//     setValidationError("");
//   }, [isOpen]);

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
        name === "delivery_number"
          ? value.toUpperCase()
          : value,
    }));

    setValidationError("");
  };

  const handleDateChange = (value) => {
    setValues((currentValues) => ({
      ...currentValues,
      delivery_date: value,
    }));

    setValidationError("");
  };

  const handleSalesOrderChange = async (
    salesOrderId,
  ) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setValues((currentValues) => ({
      ...currentValues,
      sales_order_id: salesOrderId,
      recipient_name: "",
      address: "",
    }));

    setItems([]);
    setValidationError("");

    const salesOrder =
      await onSalesOrderChange(salesOrderId);

    if (
      requestIdRef.current !== requestId ||
      !salesOrder
    ) {
      return;
    }

    setValues((currentValues) => ({
      ...currentValues,
      recipient_name:
        salesOrder.contact_person || "",
      address: salesOrder.address || "",
    }));

    setItems(createDeliveryItems(salesOrder));
  };

  const handleItemChange = (
    salesOrderItemId,
    value,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.sales_order_item_id ===
        salesOrderItemId
          ? {
              ...item,
              quantity_delivered: value,
            }
          : item,
      ),
    );

    setValidationError("");
  };

  const selectedItems = items.filter(
    (item) =>
      Number(item.quantity_delivered) > 0,
  );

  const totalQuantity = selectedItems.reduce(
    (total, item) =>
      total +
      (Number(item.quantity_delivered) || 0),
    0,
  );

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !values.delivery_number.trim() ||
      !values.sales_order_id
    ) {
      setValidationError(
        "Nomor pengiriman dan sales order wajib diisi.",
      );
      return;
    }

    if (!values.delivery_date) {
      setValidationError(
        "Tanggal pengiriman wajib diisi.",
      );
      return;
    }

    if (selectedItems.length === 0) {
      setValidationError(
        "Masukkan jumlah pengiriman minimal pada satu produk.",
      );
      return;
    }

    const inactiveItem = selectedItems.find(
      (item) =>
        item.product_status !== "ACTIVE",
    );

    if (inactiveItem) {
      setValidationError(
        `${inactiveItem.product_name} sedang tidak aktif dan tidak dapat dikirim.`,
      );
      return;
    }

    const invalidItem = selectedItems.find(
      (item) => {
        const quantity = Number(
          item.quantity_delivered,
        );

        return (
          !Number.isInteger(quantity) ||
          quantity <= 0 ||
          quantity > item.remaining_quantity ||
          quantity > item.current_stock
        );
      },
    );

    if (invalidItem) {
      setValidationError(
        `Periksa jumlah pengiriman ${invalidItem.product_name}. Jumlah tidak boleh melebihi sisa pesanan atau stok tersedia.`,
      );
      return;
    }

    onSubmit({
      delivery_number:
        values.delivery_number
          .trim()
          .toUpperCase(),
      sales_order_id: values.sales_order_id,
      delivery_date: values.delivery_date,
      recipient_name:
        values.recipient_name.trim() || null,
      address: values.address.trim() || null,
      notes: values.notes.trim() || null,
      items: selectedItems.map((item) => ({
        sales_order_item_id:
          item.sales_order_item_id,
        quantity_delivered: Number(
          item.quantity_delivered,
        ),
      })),
    });
  };

  return (
    <div
      className="goods-receipt-form-backdrop"
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
        className="goods-receipt-form-modal delivery-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-form-title"
      >
        <header className="goods-receipt-form-header">
          <div>
            <span>Sales &amp; Delivery</span>

            <h2 id="delivery-form-title">
              Tambah pengiriman
            </h2>
          </div>

          <button
            type="button"
            className="goods-receipt-form-close"
            aria-label="Tutup form pengiriman"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="goods-receipt-form"
          onSubmit={handleSubmit}
        >
          <div className="goods-receipt-form-content">
            <section className="goods-receipt-form-section">
              <div className="goods-receipt-form-section-heading">
                <div>
                  <p>Informasi pengiriman</p>

                  <span>
                    Pilih sales order yang akan
                    diproses oleh warehouse.
                  </span>
                </div>

                <Truck aria-hidden="true" />
              </div>

              <div className="goods-receipt-form-grid">
                <label className="goods-receipt-form-field">
                  <span>Nomor pengiriman</span>

                  <input
                    type="text"
                    name="delivery_number"
                    value={values.delivery_number}
                    placeholder="Contoh: DEL-2026-0003"
                    autoComplete="off"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <div className="goods-receipt-form-field">
                  <FormSelect
                    label="Sales order"
                    value={values.sales_order_id}
                    placeholder="Pilih sales order"
                    disabled={
                      isSubmitting ||
                      isLoadingSalesOrder
                    }
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

                <div className="goods-receipt-form-field">
                  <FormDatePicker
                    label="Tanggal pengiriman"
                    value={values.delivery_date}
                    disabled={isSubmitting}
                    onChange={handleDateChange}
                  />
                </div>

                <label className="goods-receipt-form-field">
                  <span>Nama penerima</span>

                  <input
                    type="text"
                    name="recipient_name"
                    value={values.recipient_name}
                    placeholder="Nama penerima barang"
                    autoComplete="off"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <label className="goods-receipt-form-field is-full">
                  <span>Alamat pengiriman</span>

                  <textarea
                    name="address"
                    value={values.address}
                    rows="3"
                    placeholder="Alamat tujuan pengiriman"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <label className="goods-receipt-form-field is-full">
                  <span>Catatan</span>

                  <textarea
                    name="notes"
                    value={values.notes}
                    rows="3"
                    placeholder="Tambahkan catatan pengiriman jika diperlukan"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            </section>

            <section className="goods-receipt-form-section">
              <div className="goods-receipt-form-section-heading">
                <div>
                  <p>Barang yang dikirim</p>

                  <span>
                    Tentukan jumlah barang pada
                    pengiriman ini.
                  </span>
                </div>

                <PackageCheck aria-hidden="true" />
              </div>

              {!values.sales_order_id && (
                <div className="goods-receipt-form-hint">
                  Pilih sales order terlebih dahulu.
                </div>
              )}

              {isLoadingSalesOrder && (
                <div className="goods-receipt-form-hint">
                  Memuat rincian sales order...
                </div>
              )}

              {values.sales_order_id &&
                !isLoadingSalesOrder &&
                selectedSalesOrder &&
                items.length === 0 && (
                  <div className="goods-receipt-form-hint is-warning">
                    Seluruh barang pada sales order ini
                    sudah dialokasikan ke pengiriman.
                  </div>
                )}

              {selectedSalesOrder &&
                !isLoadingSalesOrder && (
                  <div className="goods-receipt-form-po-summary">
                    <div>
                      <span>Sales order</span>

                      <strong>
                        {selectedSalesOrder.so_number}
                      </strong>
                    </div>

                    <div>
                      <span>Customer</span>

                      <strong>
                        {
                          selectedSalesOrder
                            .customer_name
                        }
                      </strong>
                    </div>

                    <div>
                      <span>Status</span>

                      <strong>
                        {statusLabels[
                          selectedSalesOrder.status
                        ] ||
                          selectedSalesOrder.status}
                      </strong>
                    </div>
                  </div>
                )}

              <div className="goods-receipt-form-items">
                {items.map((item) => (
                  <article
                    key={item.sales_order_item_id}
                    className="goods-receipt-form-item"
                  >
                    <div className="goods-receipt-form-item-heading">
                      <div>
                        <strong>
                          {item.product_name}
                        </strong>

                        <span>
                          {item.sku} · {item.unit}
                        </span>
                      </div>

                      <span>
                        Sisa{" "}
                        {formatNumber(
                          item.remaining_quantity,
                        )}
                      </span>
                    </div>

                    <div className="goods-receipt-form-item-grid delivery-form-item-grid">
                      <div className="goods-receipt-form-readonly">
                        <span>Dipesan</span>

                        <strong>
                          {formatNumber(
                            item.ordered_quantity,
                          )}
                        </strong>
                      </div>

                      <div className="goods-receipt-form-readonly">
                        <span>Dialokasikan</span>

                        <strong>
                          {formatNumber(
                            item.reserved_quantity,
                          )}
                        </strong>
                      </div>

                      <div className="goods-receipt-form-readonly">
                        <span>Stok tersedia</span>

                        <strong>
                          {formatNumber(
                            item.current_stock,
                          )}
                        </strong>
                      </div>

                      <label className="goods-receipt-form-field">
                        <span>Dikirim sekarang</span>

                        <input
                          type="number"
                          min="0"
                          max={Math.min(
                            item.remaining_quantity,
                            item.current_stock,
                          )}
                          step="1"
                          value={
                            item.quantity_delivered
                          }
                          disabled={
                            isSubmitting ||
                            item.product_status !==
                              "ACTIVE"
                          }
                          onChange={(event) =>
                            handleItemChange(
                              item.sales_order_item_id,
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    {item.product_status !==
                      "ACTIVE" && (
                      <div className="goods-receipt-form-hint is-warning">
                        Produk sedang tidak aktif dan
                        tidak dapat dikirim.
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {items.length > 0 && (
                <div className="goods-receipt-form-totals">
                  <div>
                    <span>Jenis produk</span>

                    <strong>
                      {formatNumber(
                        selectedItems.length,
                      )}
                    </strong>
                  </div>

                  <div className="is-stock">
                    <span>Total dikirim</span>

                    <strong>
                      {formatNumber(totalQuantity)}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            {(validationError || requestError) && (
              <div
                className="goods-receipt-form-error"
                role="alert"
              >
                {validationError || requestError}
              </div>
            )}
          </div>

          <footer className="goods-receipt-form-actions">
            <button
              type="button"
              className="goods-receipt-form-cancel"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </button>

            <button
              type="submit"
              className="goods-receipt-form-submit"
              disabled={
                isSubmitting ||
                isLoadingSalesOrder ||
                items.length === 0
              }
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : "Simpan pengiriman"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default DeliveryFormModal;