import {
  AlertTriangle,
  Ban,
  Eye,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  cancelInvoiceRequest,
  createInvoiceRequest,
  getInvoiceByIdRequest,
  getInvoiceEligibleSalesOrdersRequest,
  getInvoicesRequest,
} from "../api/invoices";
import StatusConfirmDialog from "../components/dialogs/StatusConfirmDialog";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import StatusFilter from "../components/filters/StatusFilter";
import InvoiceDetailDialog from "../components/invoices/InvoiceDetailDialog";
import InvoiceFormModal from "../components/invoices/InvoiceFormModal";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/purchase-orders.css";
import "../styles/invoices.css";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../utils/formatters";

const PAGE_LIMIT = 10;

const invoiceStatusOptions = [
  {
    value: "",
    label: "Semua status",
  },
  {
    value: "UNPAID",
    label: "Belum dibayar",
  },
  {
    value: "PARTIAL",
    label: "Dibayar sebagian",
  },
  {
    value: "PAID",
    label: "Lunas",
  },
  {
    value: "OVERDUE",
    label: "Jatuh tempo",
  },
  {
    value: "CANCELLED",
    label: "Dibatalkan",
  },
];

const statusPresentation = {
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

const InvoicesPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();

  const canManageInvoices = [
    "ADMIN",
    "FINANCE",
  ].includes(user?.role);

  const [invoices, setInvoices] =
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
  const [status, setStatus] = useState("");
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

  const [selectedInvoice, setSelectedInvoice] =
    useState(null);
  const [isDetailOpen, setIsDetailOpen] =
    useState(false);
  const [loadingDetailId, setLoadingDetailId] =
    useState("");
  const [detailError, setDetailError] =
    useState("");

  const [
    eligibleSalesOrders,
    setEligibleSalesOrders,
  ] = useState([]);

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

  const [
    invoiceToCancel,
    setInvoiceToCancel,
  ] = useState(null);
  const [
    isCancelDialogOpen,
    setIsCancelDialogOpen,
  ] = useState(false);
  const [
    isCancellingInvoice,
    setIsCancellingInvoice,
  ] = useState(false);
  const [cancelError, setCancelError] =
    useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchInvoices = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response =
          await getInvoicesRequest({
            page,
            limit: PAGE_LIMIT,
            ...(appliedSearch && {
              search: appliedSearch,
            }),
            ...(status && { status }),
            ...(dateFrom && {
              date_from: dateFrom,
            }),
            ...(dateTo && {
              date_to: dateTo,
            }),
          });

        if (!isCancelled) {
          setInvoices(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setInvoices([]);
          setPagination({
            page,
            limit: PAGE_LIMIT,
            total: 0,
            total_pages: 0,
          });

          setErrorMessage(
            error.response?.data?.message ||
              "Data invoice gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchInvoices();

    return () => {
      isCancelled = true;
    };
  }, [
    page,
    appliedSearch,
    status,
    dateFrom,
    dateTo,
    reloadKey,
  ]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleStatusChange = (
    nextStatus,
  ) => {
    setPage(1);
    setStatus(nextStatus);
  };

  const handleDateFromChange = (
    nextDateFrom,
  ) => {
    setPage(1);
    setDateFrom(nextDateFrom);
  };

  const handleDateToChange = (
    nextDateTo,
  ) => {
    setPage(1);
    setDateTo(nextDateTo);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleOpenCreateForm = async () => {
    if (!canManageInvoices) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");

      const salesOrderData =
        await getInvoiceEligibleSalesOrdersRequest();

      if (salesOrderData.length === 0) {
        setActionError(
          "Belum ada sales order terkirim yang dapat dibuatkan invoice.",
        );
        return;
      }

      setEligibleSalesOrders(salesOrderData);
      setIsFormOpen(true);
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
          "Sales order yang dapat ditagihkan gagal dimuat.",
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
    setEligibleSalesOrders([]);
    setFormError("");
  };

  const handleCreateInvoice = async (
    payload,
  ) => {
    try {
      setIsSubmitting(true);
      setFormError("");

      await createInvoiceRequest(payload);

      setIsFormOpen(false);
      setEligibleSalesOrders([]);
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "Invoice gagal ditambahkan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = async (
    invoiceId,
  ) => {
    try {
      setLoadingDetailId(invoiceId);
      setDetailError("");

      const detail =
        await getInvoiceByIdRequest(invoiceId);

      setSelectedInvoice(detail);
      setIsDetailOpen(true);
    } catch (error) {
      setDetailError(
        error.response?.data?.message ||
          "Detail invoice gagal dimuat.",
      );
    } finally {
      setLoadingDetailId("");
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedInvoice(null);
  };

  const handleOpenCancelDialog = (
    invoice,
  ) => {
    if (!canManageInvoices) {
      return;
    }

    setInvoiceToCancel(invoice);
    setCancelError("");
    setIsCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    if (isCancellingInvoice) {
      return;
    }

    setIsCancelDialogOpen(false);
    setInvoiceToCancel(null);
    setCancelError("");
  };

  const handleConfirmCancellation = async () => {
    if (!invoiceToCancel) {
      return;
    }

    try {
      setIsCancellingInvoice(true);
      setCancelError("");

      await cancelInvoiceRequest(
        invoiceToCancel.id,
      );

      setIsCancelDialogOpen(false);
      setInvoiceToCancel(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setCancelError(
        error.response?.data?.message ||
          "Invoice gagal dibatalkan.",
      );
    } finally {
      setIsCancellingInvoice(false);
    }
  };

  const totalPages = Math.max(
    pagination.total_pages,
    1,
  );

  const hasActiveFilters =
    Boolean(appliedSearch) ||
    Boolean(status) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <div className="purchase-orders-page invoices-page">
      <section className="page-heading">
        <div>
          <p>Finance</p>

          <h2>Invoices</h2>

          <span>
            Kelola tagihan customer, jatuh tempo,
            pembayaran, dan sisa piutang.
          </span>
        </div>

        <div className="page-heading-actions">
          {canManageInvoices && (
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
                  : "Tambah Invoice"}
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
          className="data-filters purchase-order-filters invoice-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              placeholder="Cari nomor invoice, SO, customer, atau catatan"
              aria-label="Cari invoice"
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
            />

            <button type="submit">
              Cari
            </button>
          </div>

          <StatusFilter
            value={status}
            options={invoiceStatusOptions}
            onChange={handleStatusChange}
            ariaLabel="Filter status invoice"
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
          <div
            className="data-error"
            role="alert"
          >
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
          <div
            className="data-error"
            role="alert"
          >
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
            <strong>{invoices.length}</strong>{" "}
            dari{" "}
            <strong>
              {formatNumber(pagination.total)}
            </strong>{" "}
            invoice
          </p>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table purchase-order-table invoice-table">
            <thead>
              <tr>
                <th>Nomor invoice</th>
                <th>Sales order</th>
                <th>Customer</th>
                <th>Tanggal</th>
                <th>Total</th>
                <th>Sisa tagihan</th>
                <th>Status</th>
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

                    Memuat data invoice...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={8}
                  >
                    <ReceiptText aria-hidden="true" />

                    Tidak ada invoice yang sesuai.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const presentation =
                    statusPresentation[
                      invoice.status
                    ] ?? {
                      label: invoice.status,
                      className: "is-unpaid",
                    };

                  const canCancelInvoice =
                    canManageInvoices &&
                    ["UNPAID", "OVERDUE"].includes(
                      invoice.status,
                    ) &&
                    Number(invoice.paid_amount) === 0;

                  return (
                    <tr key={invoice.id}>
                      <td data-label="Nomor invoice">
                        <strong className="invoice-number">
                          {invoice.invoice_number}
                        </strong>
                      </td>

                      <td data-label="Sales order">
                        <strong className="invoice-sales-order">
                          {invoice.so_number}
                        </strong>
                      </td>

                      <td data-label="Customer">
                        <strong className="invoice-customer">
                          {invoice.customer_name}
                        </strong>

                        <span className="invoice-subtext">
                          {invoice.customer_code}
                        </span>
                      </td>

                      <td data-label="Tanggal">
                        <strong className="invoice-customer">
                          {formatDate(
                            invoice.invoice_date,
                          )}
                        </strong>

                        <span className="invoice-subtext">
                          Jatuh tempo{" "}
                          {formatDate(
                            invoice.due_date,
                          )}
                        </span>
                      </td>

                      <td data-label="Total">
                        <strong className="invoice-amount">
                          {formatCurrency(
                            invoice.grand_total,
                          )}
                        </strong>
                      </td>

                      <td data-label="Sisa tagihan">
                        <strong className="invoice-amount is-outstanding">
                          {formatCurrency(
                            invoice
                              .outstanding_amount,
                          )}
                        </strong>
                      </td>

                      <td data-label="Status">
                        <span
                          className={`invoice-status ${presentation.className}`}
                        >
                          {presentation.label}
                        </span>
                      </td>

                      <td
                        className="table-action-cell"
                        data-label="Aksi"
                      >
                        <div className="table-action-buttons invoice-action-buttons">
                          <button
                            type="button"
                            className="table-edit-action purchase-order-detail-action"
                            disabled={
                              Boolean(
                                loadingDetailId,
                              ) ||
                              isCancellingInvoice
                            }
                            onClick={() =>
                              handleOpenDetail(
                                invoice.id,
                              )
                            }
                          >
                            {loadingDetailId ===
                            invoice.id ? (
                              <RefreshCw
                                className="is-spinning"
                                aria-hidden="true"
                              />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}

                            Detail
                          </button>

                          {canCancelInvoice && (
                            <button
                              type="button"
                              className="table-status-action is-deactivate"
                              disabled={
                                Boolean(
                                  loadingDetailId,
                                ) ||
                                isCancellingInvoice
                              }
                              onClick={() =>
                                handleOpenCancelDialog(
                                  invoice,
                                )
                              }
                            >
                              <Ban aria-hidden="true" />

                              Batalkan
                            </button>
                          )}
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
        <InvoiceFormModal
          isOpen
          salesOrders={eligibleSalesOrders}
          isSubmitting={isSubmitting}
          requestError={formError}
          onClose={handleCloseForm}
          onSubmit={handleCreateInvoice}
        />
      )}

      {isDetailOpen && (
        <InvoiceDetailDialog
          isOpen
          invoice={selectedInvoice}
          onClose={handleCloseDetail}
        />
      )}

      {isCancelDialogOpen &&
        invoiceToCancel && (
          <StatusConfirmDialog
            isOpen
            entityLabel="invoice"
            entityName={
              invoiceToCancel.customer_name
            }
            identifierLabel="nomor"
            identifierValue={
              invoiceToCancel.invoice_number
            }
            currentStatus={
              invoiceToCancel.status
            }
            nextStatus="CANCELLED"
            title="Batalkan invoice?"
            nextStatusLabel="dibatalkan"
            confirmLabel="Batalkan"
            tone="warning"
            isSubmitting={
              isCancellingInvoice
            }
            requestError={cancelError}
            onCancel={
              handleCloseCancelDialog
            }
            onConfirm={
              handleConfirmCancellation
            }
          />
        )}
    </div>
  );
};

export default InvoicesPage;