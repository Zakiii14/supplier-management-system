import {
  ClipboardCheck,
  PackageCheck,
  Save,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { formatNumber } from "../../utils/formatters";
import FormSelect from "../forms/FormSelect";

const createInitialValues = () => ({
  receipt_number: "",
  purchase_order_id: "",
  notes: "",
});

const createReceiptItems = (purchaseOrder) =>
  (purchaseOrder?.items || [])
    .map((item) => {
      const remainingQuantity =
        Number(item.quantity) -
        Number(item.received_quantity);

      return {
        purchase_order_item_id: item.id,
        product_id: item.product_id,
        sku: item.sku,
        product_name: item.product_name,
        unit: item.unit,
        ordered_quantity: Number(item.quantity),
        previously_received: Number(
          item.received_quantity,
        ),
        remaining_quantity: remainingQuantity,
        quantity_received: "0",
        quantity_damaged: "0",
      };
    })
    .filter(
      (item) => item.remaining_quantity > 0,
    );

const statusLabels = {
  SUBMITTED: "Diajukan",
  PARTIALLY_RECEIVED: "Diterima sebagian",
};

const GoodsReceiptFormModal = ({
  isOpen,
  purchaseOrders = [],
  selectedPurchaseOrder = null,
  isLoadingPurchaseOrder = false,
  isSubmitting = false,
  requestError = "",
  onClose,
  onPurchaseOrderChange,
  onSubmit,
}) => {
  const requestIdRef = useRef(0);

  const [values, setValues] = useState(
    createInitialValues,
  );

  const [items, setItems] = useState([]);
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
        name === "receipt_number"
          ? value.toUpperCase()
          : value,
    }));

    setValidationError("");
  };

  const handlePurchaseOrderChange = async (
    purchaseOrderId,
  ) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setValues((currentValues) => ({
      ...currentValues,
      purchase_order_id: purchaseOrderId,
    }));

    setItems([]);
    setValidationError("");

    const purchaseOrder =
      await onPurchaseOrderChange(
        purchaseOrderId,
      );

    if (
      requestIdRef.current !== requestId ||
      !purchaseOrder
    ) {
      return;
    }

    setItems(
      createReceiptItems(purchaseOrder),
    );
  };

  const handleItemChange = (
    purchaseOrderItemId,
    name,
    value,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.purchase_order_item_id ===
        purchaseOrderItemId
          ? { ...item, [name]: value }
          : item,
      ),
    );

    setValidationError("");
  };

  const totalReceived = items.reduce(
    (total, item) =>
      total +
      (Number(item.quantity_received) || 0),
    0,
  );

  const totalDamaged = items.reduce(
    (total, item) =>
      total +
      (Number(item.quantity_damaged) || 0),
    0,
  );

  const totalAddedToStock =
    totalReceived - totalDamaged;

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !values.receipt_number.trim() ||
      !values.purchase_order_id
    ) {
      setValidationError(
        "Nomor penerimaan dan purchase order wajib diisi.",
      );
      return;
    }

    const selectedItems = items.filter(
      (item) =>
        Number(item.quantity_received) > 0,
    );

    if (selectedItems.length === 0) {
      setValidationError(
        "Masukkan jumlah penerimaan minimal pada satu produk.",
      );
      return;
    }

    const invalidItem = selectedItems.find(
      (item) => {
        const received = Number(
          item.quantity_received,
        );

        const damaged = Number(
          item.quantity_damaged,
        );

        return (
          !Number.isInteger(received) ||
          !Number.isInteger(damaged) ||
          received <= 0 ||
          damaged < 0 ||
          received > item.remaining_quantity ||
          damaged > received
        );
      },
    );

    if (invalidItem) {
      setValidationError(
        `Periksa jumlah penerimaan ${invalidItem.product_name}. Jumlah diterima tidak boleh melebihi sisa pesanan dan jumlah rusak tidak boleh melebihi jumlah diterima.`,
      );
      return;
    }

    onSubmit({
      receipt_number:
        values.receipt_number
          .trim()
          .toUpperCase(),
      purchase_order_id:
        values.purchase_order_id,
      notes: values.notes.trim() || null,
      items: selectedItems.map((item) => ({
        purchase_order_item_id:
          item.purchase_order_item_id,
        quantity_received: Number(
          item.quantity_received,
        ),
        quantity_damaged: Number(
          item.quantity_damaged,
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
        className="goods-receipt-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goods-receipt-form-title"
      >
        <header className="goods-receipt-form-header">
          <div>
            <span>Warehouse</span>
            <h2 id="goods-receipt-form-title">
              Tambah penerimaan barang
            </h2>
          </div>

          <button
            type="button"
            className="goods-receipt-form-close"
            aria-label="Tutup form penerimaan"
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
                  <p>Informasi penerimaan</p>
                  <span>
                    Pilih PO yang barangnya sedang
                    diterima.
                  </span>
                </div>

                <ClipboardCheck aria-hidden="true" />
              </div>

              <div className="goods-receipt-form-grid">
                <label className="goods-receipt-form-field">
                  <span>Nomor penerimaan</span>

                  <input
                    type="text"
                    name="receipt_number"
                    value={values.receipt_number}
                    placeholder="Contoh: GR-2026-0003"
                    autoComplete="off"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>

                <div className="goods-receipt-form-field">
                  <FormSelect
                    label="Purchase order"
                    value={
                      values.purchase_order_id
                    }
                    placeholder="Pilih purchase order"
                    disabled={
                      isSubmitting ||
                      isLoadingPurchaseOrder
                    }
                    options={purchaseOrders.map(
                      (purchaseOrder) => ({
                        value: purchaseOrder.id,
                        label:
                          `${purchaseOrder.po_number} — ` +
                          `${purchaseOrder.supplier_name}`,
                      }),
                    )}
                    onChange={
                      handlePurchaseOrderChange
                    }
                  />
                </div>

                <label className="goods-receipt-form-field is-full">
                  <span>Catatan</span>

                  <textarea
                    name="notes"
                    value={values.notes}
                    rows="3"
                    placeholder="Tambahkan catatan penerimaan jika diperlukan"
                    disabled={isSubmitting}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            </section>

            <section className="goods-receipt-form-section">
              <div className="goods-receipt-form-section-heading">
                <div>
                  <p>Barang yang diterima</p>
                  <span>
                    Jumlah rusak termasuk dalam jumlah
                    diterima, tetapi tidak masuk stok.
                  </span>
                </div>

                <PackageCheck aria-hidden="true" />
              </div>

              {!values.purchase_order_id && (
                <div className="goods-receipt-form-hint">
                  Pilih purchase order terlebih dahulu.
                </div>
              )}

              {isLoadingPurchaseOrder && (
                <div className="goods-receipt-form-hint">
                  Memuat rincian purchase order...
                </div>
              )}

              {values.purchase_order_id &&
                !isLoadingPurchaseOrder &&
                selectedPurchaseOrder &&
                items.length === 0 && (
                  <div className="goods-receipt-form-hint is-warning">
                    Seluruh barang pada PO ini sudah
                    diterima.
                  </div>
                )}

              {selectedPurchaseOrder &&
                !isLoadingPurchaseOrder && (
                  <div className="goods-receipt-form-po-summary">
                    <div>
                      <span>Purchase order</span>
                      <strong>
                        {
                          selectedPurchaseOrder
                            .po_number
                        }
                      </strong>
                    </div>

                    <div>
                      <span>Supplier</span>
                      <strong>
                        {
                          selectedPurchaseOrder
                            .supplier_name
                        }
                      </strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>
                        {statusLabels[
                          selectedPurchaseOrder
                            .status
                        ] ||
                          selectedPurchaseOrder
                            .status}
                      </strong>
                    </div>
                  </div>
                )}

              <div className="goods-receipt-form-items">
                {items.map((item) => (
                  <article
                    key={
                      item.purchase_order_item_id
                    }
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

                    <div className="goods-receipt-form-item-grid">
                      <div className="goods-receipt-form-readonly">
                        <span>Dipesan</span>
                        <strong>
                          {formatNumber(
                            item.ordered_quantity,
                          )}
                        </strong>
                      </div>

                      <div className="goods-receipt-form-readonly">
                        <span>Sudah diterima</span>
                        <strong>
                          {formatNumber(
                            item.previously_received,
                          )}
                        </strong>
                      </div>

                      <label className="goods-receipt-form-field">
                        <span>Diterima sekarang</span>
                        <input
                          type="number"
                          min="0"
                          max={
                            item.remaining_quantity
                          }
                          step="1"
                          value={
                            item.quantity_received
                          }
                          disabled={isSubmitting}
                          onChange={(event) =>
                            handleItemChange(
                              item
                                .purchase_order_item_id,
                              "quantity_received",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label className="goods-receipt-form-field">
                        <span>Rusak</span>
                        <input
                          type="number"
                          min="0"
                          max={
                            item.quantity_received ||
                            "0"
                          }
                          step="1"
                          value={
                            item.quantity_damaged
                          }
                          disabled={isSubmitting}
                          onChange={(event) =>
                            handleItemChange(
                              item
                                .purchase_order_item_id,
                              "quantity_damaged",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>

              {items.length > 0 && (
                <div className="goods-receipt-form-totals">
                  <div>
                    <span>Diterima</span>
                    <strong>
                      {formatNumber(totalReceived)}
                    </strong>
                  </div>

                  <div className="is-damaged">
                    <span>Rusak</span>
                    <strong>
                      {formatNumber(totalDamaged)}
                    </strong>
                  </div>

                  <div className="is-stock">
                    <span>Masuk stok</span>
                    <strong>
                      {formatNumber(
                        totalAddedToStock,
                      )}
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
                isLoadingPurchaseOrder ||
                items.length === 0
              }
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : "Simpan penerimaan"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default GoodsReceiptFormModal;