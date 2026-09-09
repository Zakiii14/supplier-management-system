import { useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Send,
  X,
  XCircle,
} from "lucide-react";

const ACTION_CONTENT = {
  SUBMIT: {
    title: "Ajukan untuk persetujuan?",
    description: "Transaksi akan dikirim kepada pihak yang berwenang dan belum dapat diproses sampai disetujui.",
    confirmLabel: "Ajukan",
    tone: "is-success",
    Icon: Send,
  },
  APPROVE: {
    title: "Setujui transaksi?",
    description: "Transaksi akan aktif dan dapat dilanjutkan ke proses operasional berikutnya.",
    confirmLabel: "Setujui",
    tone: "is-success",
    Icon: CheckCircle2,
  },
  REJECT: {
    title: "Tolak transaksi?",
    description: "Transaksi dikembalikan kepada pengaju. Tuliskan alasan yang jelas agar dapat diperbaiki.",
    confirmLabel: "Tolak",
    tone: "is-danger",
    Icon: XCircle,
  },
  CANCEL: {
    title: "Batalkan transaksi?",
    description: "Transaksi akan ditutup dan tidak dapat diajukan kembali.",
    confirmLabel: "Batalkan transaksi",
    tone: "is-danger",
    Icon: XCircle,
  },
};

const ApprovalActionDialog = ({
  isOpen,
  action,
  transactionLabel,
  transactionNumber,
  isSubmitting = false,
  requestError = "",
  onCancel,
  onConfirm,
}) => {
  const [reason, setReason] = useState("");
  const dialogId = useId();
  const content = ACTION_CONTENT[action];

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) onCancel();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [action, isOpen, isSubmitting, onCancel]);

  if (!isOpen || !content || !transactionNumber) return null;

  const { Icon } = content;
  const normalizedReason = reason.trim();
  const isReasonInvalid = action === "REJECT" && normalizedReason.length < 5;

  return (
    <div
      className="status-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section
        className="status-dialog approval-action-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
      >
        <button
          type="button"
          className="status-dialog-close"
          aria-label="Tutup dialog persetujuan"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>

        <div className={`status-dialog-icon ${content.tone}`}>
          <Icon aria-hidden="true" />
        </div>

        <h2 id={`${dialogId}-title`}>{content.title}</h2>
        <p id={`${dialogId}-description`}>
          {transactionLabel} <strong>{transactionNumber}</strong>. {content.description}
        </p>

        {action === "REJECT" && (
          <label className="approval-reason-field">
            <span>Alasan penolakan</span>
            <textarea
              value={reason}
              rows={4}
              maxLength={500}
              placeholder="Contoh: jumlah barang atau harga perlu diperbaiki"
              disabled={isSubmitting}
              autoFocus
              onChange={(event) => setReason(event.target.value)}
            />
            <small>{normalizedReason.length}/500 · minimal 5 karakter</small>
          </label>
        )}

        {requestError && (
          <div className="status-dialog-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{requestError}</span>
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
            className={`status-dialog-confirm ${["REJECT", "CANCEL"].includes(action) ? "is-deactivate" : "is-activate"}`}
            disabled={isSubmitting || isReasonInvalid}
            onClick={() => onConfirm({ action, reason: normalizedReason })}
          >
            {isSubmitting ? "Memproses..." : content.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ApprovalActionDialog;
