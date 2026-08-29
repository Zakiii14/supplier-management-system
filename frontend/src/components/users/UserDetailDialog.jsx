import {
  AtSign,
  CalendarDays,
  Clock3,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { formatDate } from "../../utils/formatters";

const rolePresentation = {
  ADMIN: {
    label: "Administrator",
    description:
      "Mengelola seluruh modul, pengguna, dan akses sistem.",
    className: "is-admin",
  },
  PURCHASING: {
    label: "Purchasing",
    description:
      "Mengelola supplier, produk, dan proses pembelian.",
    className: "is-purchasing",
  },
  WAREHOUSE: {
    label: "Warehouse",
    description:
      "Mengelola penerimaan barang dan memantau persediaan.",
    className: "is-warehouse",
  },
  SALES: {
    label: "Sales",
    description:
      "Mengelola customer, sales order, dan proses penjualan.",
    className: "is-sales",
  },
  FINANCE: {
    label: "Finance",
    description:
      "Mengelola invoice, pembayaran, dan informasi keuangan.",
    className: "is-finance",
  },
  MANAGER: {
    label: "Manager",
    description:
      "Memantau informasi operasional lintas modul.",
    className: "is-manager",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const UserDetailDialog = ({
  isOpen,
  user,
  currentUserId = "",
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

  if (!isOpen || !user) {
    return null;
  }

  const presentation =
    rolePresentation[user.role] ?? {
      label: user.role || "-",
      description:
        "Informasi akses role tidak tersedia.",
      className: "is-manager",
    };

  const isCurrentUser = user.id === currentUserId;
  const isActive = user.status === "ACTIVE";

  return (
    <div
      className="user-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="user-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-detail-title"
      >
        <header className="user-detail-header">
          <div className="user-detail-identity">
            <div className="user-detail-avatar">
              {user.full_name
                ?.trim()
                .charAt(0)
                .toUpperCase() || "U"}
            </div>

            <div>
              <span>Pengguna</span>

              <h2 id="user-detail-title">
                {user.full_name}
              </h2>

              <p>@{user.username}</p>
            </div>
          </div>

          <div className="user-detail-heading-actions">
            {isCurrentUser && (
              <span className="user-current-badge">
                Akun Anda
              </span>
            )}

            <span
              className={`record-status ${
                isActive
                  ? "is-active"
                  : "is-inactive"
              }`}
            >
              {isActive ? "Aktif" : "Tidak aktif"}
            </span>

            <button
              type="button"
              className="user-detail-close"
              aria-label="Tutup detail pengguna"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="user-detail-content">
          <section className="user-detail-summary">
            <article>
              <ShieldCheck aria-hidden="true" />

              <div>
                <span>Role</span>

                <strong>{presentation.label}</strong>
              </div>
            </article>

            <article>
              <CalendarDays aria-hidden="true" />

              <div>
                <span>Dibuat</span>

                <strong>
                  {formatDate(user.created_at)}
                </strong>
              </div>
            </article>

            <article>
              <Clock3 aria-hidden="true" />

              <div>
                <span>Terakhir diperbarui</span>

                <strong>
                  {formatDate(user.updated_at)}
                </strong>
              </div>
            </article>
          </section>

          <section className="user-detail-information">
            <div className="user-detail-section-heading">
              <UserRound aria-hidden="true" />

              <div>
                <strong>Informasi akun</strong>

                <span>
                  Identitas yang digunakan di dalam
                  sistem.
                </span>
              </div>
            </div>

            <div className="user-detail-information-grid">
              <article>
                <AtSign aria-hidden="true" />

                <div>
                  <span>Username</span>

                  <strong>@{user.username}</strong>
                </div>
              </article>

              <article>
                <Mail aria-hidden="true" />

                <div>
                  <span>Email</span>

                  <strong>
                    {user.email ||
                      "Email tidak tersedia"}
                  </strong>
                </div>
              </article>
            </div>
          </section>

          <section
            className={`user-detail-role ${presentation.className}`}
          >
            <ShieldCheck aria-hidden="true" />

            <div>
              <span>Akses pengguna</span>

              <strong>{presentation.label}</strong>

              <p>{presentation.description}</p>
            </div>
          </section>

          <section className="user-detail-audit">
            <div>
              <span>Dibuat pada</span>

              <strong>
                {formatDateTime(user.created_at)}
              </strong>
            </div>

            <div>
              <span>Diperbarui pada</span>

              <strong>
                {formatDateTime(user.updated_at)}
              </strong>
            </div>
          </section>

          <section
            className={`user-detail-status-note ${
              isActive
                ? "is-active"
                : "is-inactive"
            }`}
          >
            <UserRound aria-hidden="true" />

            <div>
              <strong>
                {isActive
                  ? "Akun aktif"
                  : "Akun tidak aktif"}
              </strong>

              <span>
                {isActive
                  ? "Pengguna dapat login dan mengakses modul sesuai role yang diberikan."
                  : "Pengguna tidak dapat login sampai akun diaktifkan kembali."}
              </span>
            </div>
          </section>
        </div>

        <footer className="user-detail-footer">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </footer>
      </section>
    </div>
  );
};

export default UserDetailDialog;
