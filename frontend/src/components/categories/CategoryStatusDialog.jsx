import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";

const CategoryStatusDialog = ({
  isOpen,
  category,
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

  if (!isOpen || !category) {
    return null;
  }

  const isDeactivating =
    category.status === "ACTIVE";

  const nextStatus = isDeactivating
    ? "INACTIVE"
    : "ACTIVE";

  return (
    <div
      className="category-status-backdrop"
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
        className="category-status-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="category-status-title"
        aria-describedby="category-status-description"
      >
        <button
          type="button"
          className="category-status-close"
          aria-label="Tutup konfirmasi"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>

        <div
          className={`category-status-icon ${
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

        <h2 id="category-status-title">
          {isDeactivating
            ? "Nonaktifkan kategori?"
            : "Aktifkan kategori?"}
        </h2>

        <p id="category-status-description">
          Kategori{" "}
          <strong>{category.category_name}</strong>{" "}
          dengan kode{" "}
          <strong>{category.category_code}</strong>{" "}
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
            className="category-status-error"
            role="alert"
          >
            {requestError}
          </div>
        )}

        <div className="category-status-actions">
          <button
            type="button"
            className="category-status-cancel"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Batal
          </button>

          <button
            type="button"
            className={`category-status-confirm ${
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

export default CategoryStatusDialog;