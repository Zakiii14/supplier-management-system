import { useEffect } from "react";
import {
  AlertTriangle,
  Send,
  X,
} from "lucide-react";

const PurchaseOrderStatusDialog = ({
  isOpen,
  purchaseOrder,
  nextStatus,
  isSubmitting = false,
  requestError = "",
  onCancel,
  onConfirm,
}) => {
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
        onCancel();
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
  }, [isOpen, isSubmitting, onCancel]);

  if (
    !isOpen ||
    !purchaseOrder ||
    !nextStatus
  ) {
    return null;
  }

  const isSubmittingOrder =
    nextStatus === "SUBMITTED";

  const title = isSubmittingOrder
    ? "Ajukan purchase order?"
    : "Batalkan purchase order?";

  const actionLabel = isSubmittingOrder
    ? "Ajukan"
    : "Batalkan";

  return (
    <div
      className="status-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onCancel();
        }
      }}
    >
      <section
        className="status-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="purchase-order-status-title"
        aria-describedby="purchase-order-status-description"
      >
        <button
          type="button"
          className="status-dialog-close"
          aria-label="Tutup konfirmasi"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>

        <div
          className={`status-dialog-icon ${
            isSubmittingOrder
              ? "is-success"
              : "is-warning"
          }`}
        >
          {isSubmittingOrder ? (
            <Send aria-hidden="true" />
          ) : (
            <AlertTriangle aria-hidden="true" />
          )}
        </div>

        <h2 id="purchase-order-status-title">
          {title}
        </h2>

        <p id="purchase-order-status-description">
          Purchase order{" "}
          <strong>
            {purchaseOrder.po_number}
          </strong>{" "}
          {isSubmittingOrder
            ? "akan diajukan dan tidak dapat kembali menjadi draft."
            : "akan dibatalkan dan tidak dapat diproses kembali."}
        </p>

        {requestError && (
          <div
            className="status-dialog-error"
            role="alert"
          >
            {requestError}
          </div>
        )}

        <div className="status-dialog-actions">
          <button
            type="button"
            className="status-dialog-cancel"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Kembali
          </button>

          <button
            type="button"
            className={`status-dialog-confirm ${
              isSubmittingOrder
                ? "is-activate"
                : "is-deactivate"
            }`}
            disabled={isSubmitting}
            onClick={() => onConfirm(nextStatus)}
          >
            {isSubmitting
              ? "Memproses..."
              : actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

export default PurchaseOrderStatusDialog;