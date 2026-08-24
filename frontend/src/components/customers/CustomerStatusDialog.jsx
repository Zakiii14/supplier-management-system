import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";

const CustomerStatusDialog = ({
  isOpen,
  customer,
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

  if (!isOpen || !customer) {
    return null;
  }

  const isDeactivating =
    customer.status === "ACTIVE";

  const nextStatus = isDeactivating
    ? "INACTIVE"
    : "ACTIVE";

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
        aria-labelledby="customer-status-dialog-title"
        aria-describedby="customer-status-dialog-description"
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
            isDeactivating
              ? "is-warning"
              : "is-success"
          }`}
        >
          {isDeactivating ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
        </div>

        <h2 id="customer-status-dialog-title">
          {isDeactivating
            ? "Nonaktifkan customer?"
            : "Aktifkan customer?"}
        </h2>

        <p id="customer-status-dialog-description">
          Customer{" "}
          <strong>{customer.customer_name}</strong>{" "}
          dengan kode{" "}
          <strong>{customer.customer_code}</strong>{" "}
          akan diubah menjadi{" "}
          <strong>
            {isDeactivating
              ? "tidak aktif"
              : "aktif"}
          </strong>
          .
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
            Batal
          </button>

          <button
            type="button"
            className={`status-dialog-confirm ${
              isDeactivating
                ? "is-deactivate"
                : "is-activate"
            }`}
            disabled={isSubmitting}
            onClick={() => onConfirm(nextStatus)}
          >
            {isSubmitting
              ? "Memproses..."
              : isDeactivating
                ? "Nonaktifkan"
                : "Aktifkan"}
          </button>
        </div>
      </section>
    </div>
  );
};

export default CustomerStatusDialog;