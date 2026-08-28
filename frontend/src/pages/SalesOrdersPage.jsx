import {
  AlertTriangle,
  Ban,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import { getActiveCustomersRequest } from "../api/customers";
import { getActiveProductsRequest } from "../api/products";
import {
  createSalesOrderRequest,
  getSalesOrderByIdRequest,
  getSalesOrdersRequest,
  updateSalesOrderStatusRequest,
} from "../api/salesOrders";
import StatusConfirmDialog from "../components/dialogs/StatusConfirmDialog";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import StatusFilter from "../components/filters/StatusFilter";
import SalesOrderDetailDialog from "../components/sales-orders/SalesOrderDetailDialog";
import SalesOrderFormModal from "../components/sales-orders/SalesOrderFormModal";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/purchase-orders.css";
import "../styles/sales-orders.css";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../utils/formatters";

const PAGE_LIMIT = 10;

const salesOrderStatusOptions = [
  {
    value: "",
    label: "Semua status",
  },
  {
    value: "DRAFT",
    label: "Draft",
  },
  {
    value: "CONFIRMED",
    label: "Dikonfirmasi",
  },
  {
    value: "PARTIALLY_DELIVERED",
    label: "Dikirim sebagian",
  },
  {
    value: "DELIVERED",
    label: "Terkirim",
  },
  {
    value: "CANCELLED",
    label: "Dibatalkan",
  },
];

const statusPresentation = {
  DRAFT: {
    label: "Draft",
    className: "is-draft",
  },
  CONFIRMED: {
    label: "Dikonfirmasi",
    className: "is-confirmed",
  },
  PARTIALLY_DELIVERED: {
    label: "Dikirim sebagian",
    className: "is-partially-delivered",
  },
  DELIVERED: {
    label: "Terkirim",
    className: "is-delivered",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "is-cancelled",
  },
};

const SalesOrdersPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();

  const canManageSalesOrders = [
    "ADMIN",
    "SALES",
  ].includes(user?.role);

  const [salesOrders, setSalesOrders] =
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  const [selectedSalesOrder, setSelectedSalesOrder] =
    useState(null);
  const [isDetailOpen, setIsDetailOpen] =
    useState(false);
  const [loadingDetailId, setLoadingDetailId] =
    useState("");
  const [detailError, setDetailError] =
    useState("");

  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isPreparingForm, setIsPreparingForm] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] =
    useState("");

  const [statusSalesOrder, setStatusSalesOrder] =
    useState(null);
  const [nextSalesOrderStatus, setNextSalesOrderStatus] =
    useState("");
  const [isStatusDialogOpen, setIsStatusDialogOpen] =
    useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState(false);
  const [statusError, setStatusError] =
    useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchSalesOrders = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await getSalesOrdersRequest({
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
          setSalesOrders(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setSalesOrders([]);
          setPagination({
            page,
            limit: PAGE_LIMIT,
            total: 0,
            total_pages: 0,
          });
          setErrorMessage(
            error.response?.data?.message ||
            "Sales order gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchSalesOrders();

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

  const handleStatusChange = (nextStatus) => {
    setPage(1);
    setStatus(nextStatus);
  };

  const handleDateFromChange = (nextDateFrom) => {
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
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleOpenCreateForm = async () => {
    if (!canManageSalesOrders) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");

      const [customerData, productData] =
        await Promise.all([
          getActiveCustomersRequest(),
          getActiveProductsRequest(),
        ]);

      setCustomers(customerData);
      setProducts(productData);
      setIsFormOpen(true);
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
        "Customer atau produk aktif gagal dimuat.",
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
    setCustomers([]);
    setProducts([]);
    setFormError("");
  };

  const handleCreateSalesOrder = async (payload) => {
    try {
      setIsSubmitting(true);
      setFormError("");

      await createSalesOrderRequest(payload);

      setIsFormOpen(false);
      setCustomers([]);
      setProducts([]);
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
        "Sales order gagal ditambahkan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = async (salesOrderId) => {
    try {
      setLoadingDetailId(salesOrderId);
      setDetailError("");

      const detail = await getSalesOrderByIdRequest(
        salesOrderId,
      );

      setSelectedSalesOrder(detail);
      setIsDetailOpen(true);
    } catch (error) {
      setDetailError(
        error.response?.data?.message ||
        "Detail sales order gagal dimuat.",
      );
    } finally {
      setLoadingDetailId("");
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedSalesOrder(null);
  };

  const handleOpenStatusDialog = (
    salesOrder,
    nextStatus,
  ) => {
    if (!canManageSalesOrders) {
      return;
    }

    setStatusSalesOrder(salesOrder);
    setNextSalesOrderStatus(nextStatus);
    setStatusError("");
    setIsStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    if (isUpdatingStatus) {
      return;
    }

    setIsStatusDialogOpen(false);
    setStatusSalesOrder(null);
    setNextSalesOrderStatus("");
    setStatusError("");
  };

  const handleConfirmStatus = async (nextStatus) => {
    if (!statusSalesOrder) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setStatusError("");

      await updateSalesOrderStatusRequest(
        statusSalesOrder.id,
        nextStatus,
      );

      setIsStatusDialogOpen(false);
      setStatusSalesOrder(null);
      setNextSalesOrderStatus("");
      setReloadKey((current) => current + 1);
    } catch (error) {
      setStatusError(
        error.response?.data?.message ||
        "Status sales order gagal diperbarui.",
      );
    } finally {
      setIsUpdatingStatus(false);
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

  const isCancelling =
    nextSalesOrderStatus === "CANCELLED";

  return (
    <div className="purchase-orders-page sales-orders-page">
      <section className="page-heading">
        <div>
          <p>Sales &amp; Delivery</p>
          <h2>Sales Orders</h2>
          <span>
            Kelola pesanan customer, jadwal pengiriman,
            nilai transaksi, dan status pemenuhan.
          </span>
        </div>

        <div className="page-heading-actions">
          {canManageSalesOrders && (
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
                  : "Tambah SO"}
              </span>
            </button>
          )}

          <button
            type="button"
            className="secondary-action"
            disabled={isLoading}
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
          >
            <RefreshCw
              className={isLoading ? "is-spinning" : ""}
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
          className="data-filters purchase-order-filters sales-order-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              placeholder="Cari nomor SO, customer, atau catatan"
              aria-label="Cari sales order"
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />

            <button type="submit">Cari</button>
          </div>

          <StatusFilter
            value={status}
            options={salesOrderStatusOptions}
            onChange={handleStatusChange}
            ariaLabel="Filter status sales order"
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
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
          />
        </form>

        {errorMessage && (
          <div className="data-error" role="alert">
            <AlertTriangle aria-hidden="true" />

            <div>
              <strong>Data tidak dapat ditampilkan</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {detailError && (
          <div className="data-error" role="alert">
            <AlertTriangle aria-hidden="true" />

            <div>
              <strong>Detail tidak dapat ditampilkan</strong>
              <span>{detailError}</span>
            </div>
          </div>
        )}

        <div className="table-summary">
          <p>
            Menampilkan{" "}
            <strong>{salesOrders.length}</strong> dari{" "}
            <strong>
              {formatNumber(pagination.total)}
            </strong>{" "}
            sales order
          </p>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table purchase-order-table sales-order-table">
            <thead>
              <tr>
                <th>Nomor SO</th>
                <th>Customer</th>
                <th>Tanggal pesan</th>
                <th>Jadwal kirim</th>
                <th>Item</th>
                <th>Total</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td className="table-message" colSpan={8}>
                    <RefreshCw
                      className="is-spinning"
                      aria-hidden="true"
                    />
                    Memuat sales order...
                  </td>
                </tr>
              ) : salesOrders.length === 0 ? (
                <tr>
                  <td className="table-message" colSpan={8}>
                    <ShoppingBag aria-hidden="true" />
                    Tidak ada sales order yang sesuai.
                  </td>
                </tr>
              ) : (
                salesOrders.map((salesOrder) => {
                  const presentation =
                    statusPresentation[
                      salesOrder.status
                    ] ?? {
                      label: salesOrder.status,
                      className: "is-draft",
                    };

                  return (
                    <tr key={salesOrder.id}>
                      <td data-label="Nomor SO">
                        <strong className="purchase-order-number">
                          {salesOrder.so_number}
                        </strong>
                      </td>

                      <td data-label="Customer">
                        <strong className="purchase-order-supplier">
                          {salesOrder.customer_name}
                        </strong>
                        <span className="purchase-order-subtext">
                          {salesOrder.customer_code}
                        </span>
                      </td>

                      <td data-label="Tanggal pesan">
                        {formatDate(salesOrder.order_date)}
                      </td>

                      <td data-label="Jadwal kirim">
                        {formatDate(
                          salesOrder.requested_delivery_date,
                        )}
                      </td>

                      <td data-label="Item">
                        <span className="purchase-order-items">
                          {formatNumber(
                            salesOrder.total_items,
                          )}{" "}
                          item
                        </span>
                      </td>

                      <td data-label="Total">
                        <strong className="purchase-order-total">
                          {formatCurrency(
                            salesOrder.total_amount,
                          )}
                        </strong>
                      </td>

                      <td data-label="Status">
                        <span
                          className={`sales-order-status ${presentation.className}`}
                        >
                          {presentation.label}
                        </span>
                      </td>

                      <td
                        className="table-action-cell"
                        data-label="Aksi"
                      >
                        <div className="table-action-buttons purchase-order-action-buttons">
                          <button
                            type="button"
                            className="table-edit-action purchase-order-detail-action"
                            disabled={
                              Boolean(loadingDetailId) ||
                              isUpdatingStatus
                            }
                            onClick={() =>
                              handleOpenDetail(salesOrder.id)
                            }
                          >
                            {loadingDetailId === salesOrder.id ? (
                              <RefreshCw
                                className="is-spinning"
                                aria-hidden="true"
                              />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}

                            Detail
                          </button>

                          {canManageSalesOrders &&
                            salesOrder.status === "DRAFT" && (
                              <button
                                type="button"
                                className="table-status-action is-activate"
                                disabled={
                                  Boolean(loadingDetailId) ||
                                  isUpdatingStatus
                                }
                                onClick={() =>
                                  handleOpenStatusDialog(
                                    salesOrder,
                                    "CONFIRMED",
                                  )
                                }
                              >
                                <Send aria-hidden="true" />
                                Konfirmasi
                              </button>
                            )}

                          {canManageSalesOrders &&
                            ["DRAFT", "CONFIRMED"].includes(
                              salesOrder.status,
                            ) && (
                              <button
                                type="button"
                                className="table-status-action is-deactivate"
                                disabled={
                                  Boolean(loadingDetailId) ||
                                  isUpdatingStatus
                                }
                                onClick={() =>
                                  handleOpenStatusDialog(
                                    salesOrder,
                                    "CANCELLED",
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
        <SalesOrderFormModal
          isOpen
          customers={customers}
          products={products}
          isSubmitting={isSubmitting}
          requestError={formError}
          onClose={handleCloseForm}
          onSubmit={handleCreateSalesOrder}
        />
      )}

      {isDetailOpen && (
        <SalesOrderDetailDialog
          isOpen
          salesOrder={selectedSalesOrder}
          onClose={handleCloseDetail}
        />
      )}

      {isStatusDialogOpen && statusSalesOrder && (
        <StatusConfirmDialog
          isOpen
          entityLabel="sales order"
          entityName={statusSalesOrder.customer_name}
          identifierLabel="nomor"
          identifierValue={statusSalesOrder.so_number}
          currentStatus={statusSalesOrder.status}
          nextStatus={nextSalesOrderStatus}
          title={
            isCancelling
              ? "Batalkan sales order?"
              : "Konfirmasi sales order?"
          }
          nextStatusLabel={
            isCancelling
              ? "dibatalkan"
              : "dikonfirmasi"
          }
          confirmLabel={
            isCancelling
              ? "Batalkan"
              : "Konfirmasi"
          }
          tone={isCancelling ? "warning" : "success"}
          isSubmitting={isUpdatingStatus}
          requestError={statusError}
          onCancel={handleCloseStatusDialog}
          onConfirm={handleConfirmStatus}
        />
      )}
    </div>
  );
};

export default SalesOrdersPage;
