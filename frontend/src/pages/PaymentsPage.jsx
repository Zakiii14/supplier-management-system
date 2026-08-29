import {
  AlertTriangle,
  Eye,
  Plus,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  createPaymentRequest,
  getPaymentByIdRequest,
  getPaymentEligibleInvoicesRequest,
  getPaymentsRequest,
} from "../api/payments";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import StatusFilter from "../components/filters/StatusFilter";
import PaymentDetailDialog from "../components/payments/PaymentDetailDialog";
import PaymentFormModal from "../components/payments/PaymentFormModal";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/purchase-orders.css";
import "../styles/invoices.css";
import "../styles/payments.css";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../utils/formatters";

const PAGE_LIMIT = 10;

const paymentMethodOptions = [
  {
    value: "",
    label: "Semua metode",
  },
  {
    value: "BANK_TRANSFER",
    label: "Transfer bank",
  },
  {
    value: "CASH",
    label: "Tunai",
  },
  {
    value: "GIRO",
    label: "Giro",
  },
  {
    value: "OTHER",
    label: "Lainnya",
  },
];

const methodPresentation = {
  BANK_TRANSFER: {
    label: "Transfer bank",
    className: "is-bank-transfer",
  },
  CASH: {
    label: "Tunai",
    className: "is-cash",
  },
  GIRO: {
    label: "Giro",
    className: "is-giro",
  },
  OTHER: {
    label: "Lainnya",
    className: "is-other",
  },
};

const invoiceStatusPresentation = {
  UNPAID: {
    label: "Belum dibayar",
    className: "is-unpaid",
  },
  PARTIAL: {
    label: "Dibayar sebagian",
    className: "is-partial",
  },
  PAID: {
    label: "Lunas",
    className: "is-paid",
  },
  OVERDUE: {
    label: "Jatuh tempo",
    className: "is-overdue",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "is-cancelled",
  },
};

const PaymentsPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();

  const canManagePayments = [
    "ADMIN",
    "FINANCE",
  ].includes(user?.role);

  const [payments, setPayments] =
    useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    total_pages: 0,
  });

  const [searchInput, setSearchInput] =
    useState("");
  const [appliedSearch, setAppliedSearch] =
    useState("");
  const [method, setMethod] = useState("");
  const [dateFrom, setDateFrom] =
    useState("");
  const [dateTo, setDateTo] =
    useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] =
    useState(0);
  const [isLoading, setIsLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  const [selectedPayment, setSelectedPayment] =
    useState(null);
  const [isDetailOpen, setIsDetailOpen] =
    useState(false);
  const [loadingDetailId, setLoadingDetailId] =
    useState("");
  const [detailError, setDetailError] =
    useState("");

  const [eligibleInvoices, setEligibleInvoices] =
    useState([]);
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [isPreparingForm, setIsPreparingForm] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [formError, setFormError] =
    useState("");
  const [actionError, setActionError] =
    useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchPayments = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response =
          await getPaymentsRequest({
            page,
            limit: PAGE_LIMIT,
            ...(appliedSearch && {
              search: appliedSearch,
            }),
            ...(method && { method }),
            ...(dateFrom && {
              date_from: dateFrom,
            }),
            ...(dateTo && {
              date_to: dateTo,
            }),
          });

        if (!isCancelled) {
          setPayments(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setPayments([]);
          setPagination({
            page,
            limit: PAGE_LIMIT,
            total: 0,
            total_pages: 0,
          });

          setErrorMessage(
            error.response?.data?.message ||
              "Data pembayaran gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPayments();

    return () => {
      isCancelled = true;
    };
  }, [
    page,
    appliedSearch,
    method,
    dateFrom,
    dateTo,
    reloadKey,
  ]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleMethodChange = (nextMethod) => {
    setPage(1);
    setMethod(nextMethod);
  };

  const handleDateFromChange = (
    nextDateFrom,
  ) => {
    setPage(1);
    setDateFrom(nextDateFrom);
  };

  const handleDateToChange = (nextDateTo) => {
    setPage(1);
    setDateTo(nextDateTo);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setMethod("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleOpenCreateForm = async () => {
    if (!canManagePayments) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");

      const invoiceData =
        await getPaymentEligibleInvoicesRequest();

      if (invoiceData.length === 0) {
        setActionError(
          "Belum ada invoice dengan sisa tagihan yang dapat menerima pembayaran.",
        );
        return;
      }

      setEligibleInvoices(invoiceData);
      setIsFormOpen(true);
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
          "Invoice yang dapat dibayar gagal dimuat.",
      );
    } finally {
      setIsPreparingForm(false);
    }
  };

  const handleCloseForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setEligibleInvoices([]);
    setFormError("");
  };

  const handleCreatePayment = async (payload) => {
    try {
      setIsSubmitting(true);
      setFormError("");

      await createPaymentRequest(payload);

      setIsFormOpen(false);
      setEligibleInvoices([]);
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "Pembayaran gagal ditambahkan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = async (paymentId) => {
    try {
      setLoadingDetailId(paymentId);
      setDetailError("");

      const detail =
        await getPaymentByIdRequest(paymentId);

      setSelectedPayment(detail);
      setIsDetailOpen(true);
    } catch (error) {
      setDetailError(
        error.response?.data?.message ||
          "Detail pembayaran gagal dimuat.",
      );
    } finally {
      setLoadingDetailId("");
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedPayment(null);
  };

  const totalPages = Math.max(
    pagination.total_pages,
    1,
  );

  const hasActiveFilters =
    Boolean(appliedSearch) ||
    Boolean(method) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <div className="purchase-orders-page payments-page">
      <section className="page-heading">
        <div>
          <p>Finance</p>

          <h2>Pembayaran</h2>

          <span>
            Catat penerimaan pembayaran dan pantau
            pelunasan invoice customer.
          </span>
        </div>

        <div className="page-heading-actions">
          {canManagePayments && (
            <button
              type="button"
              className="primary-action"
              disabled={isPreparingForm}
              onClick={handleOpenCreateForm}
            >
              {isPreparingForm ? (
                <RefreshCw
                  className="is-spinning"
                  aria-hidden="true"
                />
              ) : (
                <Plus aria-hidden="true" />
              )}

              <span>
                {isPreparingForm
                  ? "Menyiapkan..."
                  : "Tambah Pembayaran"}
              </span>
            </button>
          )}

          <button
            type="button"
            className="secondary-action"
            disabled={isLoading}
            onClick={() =>
              setReloadKey(
                (current) => current + 1,
              )
            }
          >
            <RefreshCw
              className={
                isLoading ? "is-spinning" : ""
              }
              aria-hidden="true"
            />

            Muat ulang
          </button>
        </div>
      </section>

      {actionError && (
        <div
          className="purchase-order-action-error"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" />

          <span>{actionError}</span>
        </div>
      )}

      <section className="data-panel">
        <form
          ref={filtersRef}
          className="data-filters purchase-order-filters payment-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              placeholder="Cari pembayaran, invoice, SO, customer, atau referensi"
              aria-label="Cari pembayaran"
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />

            <button type="submit">Cari</button>
          </div>

          <StatusFilter
            value={method}
            options={paymentMethodOptions}
            onChange={handleMethodChange}
            ariaLabel="Filter metode pembayaran"
          />

          {hasActiveFilters && (
            <button
              type="button"
              className="reset-filter"
              onClick={handleResetFilters}
            >
              <X aria-hidden="true" />

              Reset
            </button>
          )}

          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            disabled={isLoading}
            onDateFromChange={
              handleDateFromChange
            }
            onDateToChange={
              handleDateToChange
            }
          />
        </form>

        {errorMessage && (
          <div className="data-error" role="alert">
            <AlertTriangle aria-hidden="true" />

            <div>
              <strong>
                Data tidak dapat ditampilkan
              </strong>

              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {detailError && (
          <div className="data-error" role="alert">
            <AlertTriangle aria-hidden="true" />

            <div>
              <strong>
                Detail tidak dapat ditampilkan
              </strong>

              <span>{detailError}</span>
            </div>
          </div>
        )}

        <div className="table-summary">
          <p>
            Menampilkan{" "}
            <strong>{payments.length}</strong>{" "}
            dari{" "}
            <strong>
              {formatNumber(pagination.total)}
            </strong>{" "}
            pembayaran
          </p>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table purchase-order-table payment-table">
            <thead>
              <tr>
                <th>Nomor pembayaran</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Tanggal</th>
                <th>Metode</th>
                <th>Jumlah</th>
                <th>Status invoice</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={8}
                  >
                    <RefreshCw
                      className="is-spinning"
                      aria-hidden="true"
                    />

                    Memuat data pembayaran...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={8}
                  >
                    <WalletCards aria-hidden="true" />

                    Tidak ada pembayaran yang sesuai.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const methodInfo =
                    methodPresentation[
                      payment.method
                    ] ?? {
                      label: payment.method,
                      className: "is-other",
                    };

                  const invoiceInfo =
                    invoiceStatusPresentation[
                      payment.invoice_status
                    ] ?? {
                      label: payment.invoice_status,
                      className: "is-unpaid",
                    };

                  return (
                    <tr key={payment.id}>
                      <td data-label="Nomor pembayaran">
                        <strong className="payment-number">
                          {payment.payment_number}
                        </strong>

                        <span className="payment-subtext">
                          {payment.reference_number ||
                            "Tanpa referensi"}
                        </span>
                      </td>

                      <td data-label="Invoice">
                        <strong className="payment-invoice">
                          {payment.invoice_number}
                        </strong>

                        <span className="payment-subtext">
                          {payment.so_number}
                        </span>
                      </td>

                      <td data-label="Customer">
                        <strong className="payment-customer">
                          {payment.customer_name}
                        </strong>

                        <span className="payment-subtext">
                          {payment.customer_code}
                        </span>
                      </td>

                      <td data-label="Tanggal">
                        <strong className="payment-date">
                          {formatDate(
                            payment.payment_date,
                          )}
                        </strong>

                        <span className="payment-subtext">
                          {payment.received_by_name ||
                            "Penerima tidak tersedia"}
                        </span>
                      </td>

                      <td data-label="Metode">
                        <span
                          className={`payment-method-badge ${methodInfo.className}`}
                        >
                          {methodInfo.label}
                        </span>
                      </td>

                      <td data-label="Jumlah">
                        <strong className="payment-amount">
                          {formatCurrency(
                            payment.amount,
                          )}
                        </strong>
                      </td>

                      <td data-label="Status invoice">
                        <span
                          className={`invoice-status ${invoiceInfo.className}`}
                        >
                          {invoiceInfo.label}
                        </span>
                      </td>

                      <td
                        className="table-action-cell"
                        data-label="Aksi"
                      >
                        <div className="table-action-buttons payment-action-buttons">
                          <button
                            type="button"
                            className="table-edit-action purchase-order-detail-action"
                            disabled={Boolean(
                              loadingDetailId,
                            )}
                            onClick={() =>
                              handleOpenDetail(
                                payment.id,
                              )
                            }
                          >
                            {loadingDetailId ===
                            payment.id ? (
                              <RefreshCw
                                className="is-spinning"
                                aria-hidden="true"
                              />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}

                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          totalPages={totalPages}
          isLoading={isLoading}
          onPageChange={setPage}
        />
      </section>

      {isFormOpen && (
        <PaymentFormModal
          isOpen
          invoices={eligibleInvoices}
          isSubmitting={isSubmitting}
          requestError={formError}
          onClose={handleCloseForm}
          onSubmit={handleCreatePayment}
        />
      )}

      {isDetailOpen && (
        <PaymentDetailDialog
          isOpen
          payment={selectedPayment}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
};

export default PaymentsPage;
