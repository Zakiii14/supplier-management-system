import {
  AlertTriangle,
  Bell,
  Boxes,
  CheckCheck,
  ClipboardCheck,
  CircleDollarSign,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  UserRoundPlus,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getNotificationsRequest, markNotificationsReadRequest } from "../../api/notifications";

const ICONS = {
  LOW_STOCK: Boxes,
  PURCHASE_ORDER: ShoppingCart,
  GOODS_RECEIPT: PackageCheck,
  CUSTOMER_INVOICE: ReceiptText,
  SUPPLIER_INVOICE: CircleDollarSign,
  STOCK_OPNAME_APPROVAL: ClipboardCheck,
  USER: UserRoundPlus,
};

const relativeTime = (value) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Baru saja";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
};

const NotificationCenter = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setIsLoading(true);
      setError("");
      const response = await getNotificationsRequest();
      setItems(response.data);
      setUnreadCount(response.unread_count);
    } catch (requestError) {
      if (!quiet) setError(requestError.response?.data?.message || "Notifikasi gagal dimuat.");
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => load(), 0);
    const refreshTimer = window.setInterval(() => load({ quiet: true }), 60000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [load, location.pathname]);

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setIsOpen(false);
    };
    const escape = (event) => event.key === "Escape" && setIsOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const markRead = async (keys) => {
    if (!keys.length) return;
    await markNotificationsReadRequest(keys);
    setItems((current) => current.map((item) => keys.includes(item.key) ? { ...item, is_read: true } : item));
    setUnreadCount((current) => Math.max(0, current - keys.filter((key) => items.some((item) => item.key === key && !item.is_read)).length));
  };

  const openItem = async (item) => {
    if (!item.is_read) await markRead([item.key]);
    setIsOpen(false);
    navigate(item.path, {
      state: {
        notificationTarget: {
          id: item.entity_id,
          label: item.entity_label,
          notificationKey: item.key,
        },
      },
    });
  };

  return (
    <div className="notification-center" ref={rootRef}>
      <button type="button" className="notification-trigger" aria-label={`${unreadCount} notifikasi belum dibaca`} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <Bell aria-hidden="true" />
        {unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {isOpen && <section className="notification-dropdown">
        <header>
          <div><strong>Notifikasi</strong><span>{unreadCount} belum dibaca</span></div>
          {unreadCount > 0 && <button type="button" onClick={() => markRead(items.filter((item) => !item.is_read).map((item) => item.key))}><CheckCheck />Tandai semua</button>}
        </header>
        <div className="notification-list">
          {isLoading ? <div className="notification-state"><RefreshCw className="is-spinning" />Memuat notifikasi...</div>
            : error ? <div className="notification-state is-error"><AlertTriangle />{error}<button type="button" onClick={() => load()}>Coba lagi</button></div>
            : items.length === 0 ? <div className="notification-state"><Bell />Tidak ada notifikasi aktif.</div>
            : items.map((item) => {
              const Icon = ICONS[item.type] || Bell;
              return <button type="button" className={`notification-item is-${item.severity.toLowerCase()} ${item.is_read ? "is-read" : ""}`} key={item.key} onClick={() => openItem(item)}>
                <span className="notification-icon"><Icon /></span>
                <span className="notification-copy"><strong>{item.title}</strong><span>{item.description}</span><small>{relativeTime(item.occurred_at)}</small></span>
                {!item.is_read && <span className="notification-unread" />}
              </button>;
            })}
        </div>
        <footer><button type="button" onClick={() => load()}><RefreshCw />Perbarui notifikasi</button></footer>
      </section>}
    </div>
  );
};

export default NotificationCenter;
