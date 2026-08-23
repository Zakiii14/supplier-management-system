import { useEffect } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  CalendarClock,
  FileText,
  Link2,
  UserRound,
  X,
} from "lucide-react";
import { formatNumber } from "../../utils/formatters";

const movementPresentation = {
  PURCHASE_RECEIPT: {
    label: "Penerimaan pembelian",
    className: "is-inbound",
  },
  SALES_ISSUE: {
    label: "Pengeluaran penjualan",
    className: "is-outbound",
  },
  ADJUSTMENT_IN: {
    label: "Penyesuaian masuk",
    className: "is-inbound",
  },
  ADJUSTMENT_OUT: {
    label: "Penyesuaian keluar",
    className: "is-outbound",
  },
  RETURN_IN: {
    label: "Retur masuk",
    className: "is-return",
  },
  RETURN_OUT: {
    label: "Retur keluar",
    className: "is-outbound",
  },
};

const outboundMovementTypes = new Set([
  "SALES_ISSUE",
  "ADJUSTMENT_OUT",
  "RETURN_OUT",
]);

const dateTimeFormatter = new Intl.DateTimeFormat(
  "id-ID",
  {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
);

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "-"
    : dateTimeFormatter.format(date);
};

const InventoryMovementDetailDialog = ({
  isOpen,
  movement,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
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
  }, [isOpen, onClose]);

  if (!isOpen || !movement) {
    return null;
  }

  const presentation =
    movementPresentation[movement.movement_type] ?? {
      label: movement.movement_type,
      className: "",
    };

  const isOutbound = outboundMovementTypes.has(
    movement.movement_type,
  );

  const DirectionIcon = isOutbound
    ? ArrowUpFromLine
    : ArrowDownToLine;

  return (
    <div
      className="inventory-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="inventory-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-detail-title"
      >
        <header className="inventory-detail-header">
          <div>
            <span>Riwayat inventory</span>

            <h2 id="inventory-detail-title">
              Detail pergerakan stok
            </h2>
          </div>

          <div className="inventory-detail-heading-actions">
            <span
              className={`inventory-movement-badge ${presentation.className}`}
            >
              {presentation.label}
            </span>

            <button
              type="button"
              className="inventory-detail-close"
              aria-label="Tutup detail inventory"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="inventory-detail-content">
          <section className="inventory-detail-summary">
            <article>
              <Box aria-hidden="true" />

              <div>
                <span>Produk</span>
                <strong>
                  {movement.product_name}
                </strong>
                <small>
                  {movement.sku} · {movement.unit}
                </small>
              </div>
            </article>

            <article
              className={
                isOutbound
                  ? "is-outbound"
                  : "is-inbound"
              }
            >
              <DirectionIcon aria-hidden="true" />

              <div>
                <span>Kuantitas</span>
                <strong>
                  {isOutbound ? "-" : "+"}
                  {formatNumber(movement.quantity)}{" "}
                  {movement.unit}
                </strong>
                <small>
                  {isOutbound
                    ? "Stok keluar"
                    : "Stok masuk"}
                </small>
              </div>
            </article>

            <article>
              <CalendarClock aria-hidden="true" />

              <div>
                <span>Waktu pergerakan</span>
                <strong>
                  {formatDateTime(
                    movement.movement_date,
                  )}
                </strong>
              </div>
            </article>

            <article>
              <UserRound aria-hidden="true" />

              <div>
                <span>Dibuat oleh</span>
                <strong>
                  {movement.created_by_name ||
                    "Sistem"}
                </strong>
                <small>
                  {movement.created_by ||
                    "Proses otomatis"}
                </small>
              </div>
            </article>
          </section>

          <section className="inventory-detail-reference">
            <div className="inventory-detail-section-heading">
              <div>
                <strong>Sumber transaksi</strong>
                <span>
                  Referensi yang menghasilkan perubahan
                  stok ini.
                </span>
              </div>

              <Link2 aria-hidden="true" />
            </div>

            <div className="inventory-detail-reference-grid">
              <div>
                <span>Jenis referensi</span>
                <strong>
                  {movement.reference_type || "-"}
                </strong>
              </div>

              <div>
                <span>ID referensi</span>
                <strong>
                  {movement.reference_id || "-"}
                </strong>
              </div>

              <div>
                <span>ID pergerakan</span>
                <strong>{movement.id}</strong>
              </div>
            </div>
          </section>

          <section className="inventory-detail-notes">
            <div className="inventory-detail-section-heading">
              <div>
                <strong>Catatan</strong>
                <span>
                  Keterangan tambahan dari transaksi.
                </span>
              </div>

              <FileText aria-hidden="true" />
            </div>

            <p>
              {movement.notes?.trim() ||
                "Tidak ada catatan untuk pergerakan ini."}
            </p>
          </section>
        </div>

        <footer className="inventory-detail-footer">
          <button
            type="button"
            onClick={onClose}
          >
            Tutup
          </button>
        </footer>
      </section>
    </div>
  );
};

export default InventoryMovementDetailDialog;