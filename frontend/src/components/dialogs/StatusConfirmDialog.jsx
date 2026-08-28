import {
  useEffect,
  useId,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";

const StatusConfirmDialog = ({
  isOpen,
  entityLabel = "data",
  entityName = "",
  identifierLabel = "kode",
  identifierValue = "",
  currentStatus = "",
  nextStatus: requestedNextStatus = "",
  title = "",
  nextStatusLabel = "",
  confirmLabel = "",
  tone = "",
  isSubmitting = false,
  requestError = "",
  onCancel,
  onConfirm,
}) => {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

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
    !entityName ||
    !identifierValue ||
    (!currentStatus && !requestedNextStatus)
  ) {
    return null;
  }

  const isDefaultDeactivation =
    currentStatus === "ACTIVE";

  const resolvedNextStatus =
    requestedNextStatus ||
    (isDefaultDeactivation
      ? "INACTIVE"
      : "ACTIVE");

  const isWarning =
    tone === "warning" ||
    (!tone && isDefaultDeactivation);

  const resolvedNextStatusLabel =
    nextStatusLabel ||
    (isDefaultDeactivation
      ? "tidak aktif"
      : "aktif");

  const resolvedTitle =
    title ||
    (isDefaultDeactivation
      ? `Nonaktifkan ${entityLabel}?`
      : `Aktifkan ${entityLabel}?`);

  const resolvedConfirmLabel =
    confirmLabel ||
    (isDefaultDeactivation
      ? "Nonaktifkan"
      : "Aktifkan");

  const displayEntityLabel =
    entityLabel.charAt(0).toUpperCase() +
    entityLabel.slice(1);

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
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
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
            isWarning
              ? "is-warning"
              : "is-success"
          }`}
        >
          {isWarning ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
        </div>

        <h2 id={titleId}>
          {resolvedTitle}
        </h2>

        <p id={descriptionId}>
          {displayEntityLabel}{" "}
          <strong>{entityName}</strong> dengan{" "}
          {identifierLabel}{" "}
          <strong>{identifierValue}</strong>{" "}
          akan diubah menjadi{" "}
          <strong>
            {resolvedNextStatusLabel}
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
              isWarning
                ? "is-deactivate"
                : "is-activate"
            }`}
            disabled={isSubmitting}
            onClick={() =>
              onConfirm(resolvedNextStatus)
            }
          >
            {isSubmitting
              ? "Memproses..."
              : resolvedConfirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

export default StatusConfirmDialog;