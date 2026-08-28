import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  createDeliveryRequest,
  getDeliveriesRequest,
  getDeliveryByIdRequest,
  updateDeliveryStatusRequest,
} from "../api/deliveries";
import {
  getDeliverableSalesOrdersRequest,
  getSalesOrderByIdRequest,
} from "../api/salesOrders";
import DeliveryDetailDialog from "../components/deliveries/DeliveryDetailDialog";
import DeliveryFormModal from "../components/deliveries/DeliveryFormModal";
import StatusConfirmDialog from "../components/dialogs/StatusConfirmDialog";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import StatusFilter from "../components/filters/StatusFilter";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/purchase-orders.css";
import "../styles/goods-receipts.css";
import "../styles/deliveries.css";
import {
  formatDate,
  formatNumber,
} from "../utils/formatters";

const PAGE_LIMIT = 10;

const deliveryStatusOptions = [
  {
    value: "",
    label: "Semua status",
  },
  {
    value: "PENDING",
    label: "Menunggu",
  },
  {
    value: "SHIPPED",
    label: "Dalam pengiriman",
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
  PENDING: {
    label: "Menunggu",
    className: "is-pending",
  },
  SHIPPED: {
    label: "Dalam pengiriman",
    className: "is-shipped",
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

const statusDialogPresentation = {
  SHIPPED: {
    title: "Proses pengiriman?",
    nextStatusLabel: "dalam pengiriman",
    confirmLabel: "Kirim barang",
    tone: "success",
  },
  DELIVERED: {
    title: "Tandai sudah diterima?",
    nextStatusLabel: "sudah diterima",
    confirmLabel: "Sudah diterima",
    tone: "success",
  },
  CANCELLED: {
    title: "Batalkan pengiriman?",
    nextStatusLabel: "dibatalkan",
    confirmLabel: "Batalkan",
    tone: "warning",
  },
};

const DeliveriesPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();

  const canManageDeliveries = [
    "ADMIN",
    "WAREHOUSE",
  ].includes(user?.role);

  const [deliveries, setDeliveries] =
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

  const [selectedDelivery, setSelectedDelivery] =
    useState(null);
  const [isDetailOpen, setIsDetailOpen] =
    useState(false);
  const [loadingDetailId, setLoadingDetailId] =
    useState("");
  const [detailError, setDetailError] =
    useState("");

  const [
    deliverableSalesOrders,
    setDeliverableSalesOrders,
  ] = useState([]);

  const [
    selectedSalesOrder,
    setSelectedSalesOrder,
  ] = useState(null);

  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [isPreparingForm, setIsPreparingForm] =
    useState(false);
  const [
    isLoadingSalesOrder,
    setIsLoadingSalesOrder,
  ] = useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [formError, setFormError] =
    useState("");
  const [actionError, setActionError] =
    useState("");

  const [statusDelivery, setStatusDelivery] =
    useState(null);
  const [
    nextDeliveryStatus,
    setNextDeliveryStatus,
  ] = useState("");
  const [
    isStatusDialogOpen,
    setIsStatusDialogOpen,
  ] = useState(false);
  const [
    isUpdatingStatus,
    setIsUpdatingStatus,
  ] = useState(false);
  const [statusError, setStatusError] =
    useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchDeliveries = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response =
          await getDeliveriesRequest({
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
          setDeliveries(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setDeliveries([]);
          setPagination({
            page,
            limit: PAGE_LIMIT,
            total: 0,
            total_pages: 0,
          });

          setErrorMessage(
            error.response?.data?.message ||
              "Data pengiriman gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDeliveries();

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
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleOpenCreateForm = async () => {
    if (!canManageDeliveries) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");

      const salesOrderData =
        await getDeliverableSalesOrdersRequest();

      if (salesOrderData.length === 0) {
        setActionError(
          "Belum ada sales order yang siap dibuatkan pengiriman.",
        );
        return;
      }

      setDeliverableSalesOrders(
        salesOrderData,
      );

      setSelectedSalesOrder(null);
      setIsFormOpen(true);
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
          "Sales order yang siap dikirim gagal dimuat.",
      );
    } finally {
      setIsPreparingForm(false);
    }
  };

  const handleSalesOrderChange = async (
    salesOrderId,
  ) => {
    setFormError("");
    setSelectedSalesOrder(null);

    if (!salesOrderId) {
      return null;
    }

    try {
      setIsLoadingSalesOrder(true);

      const salesOrder =
        await getSalesOrderByIdRequest(
          salesOrderId,
        );

      setSelectedSalesOrder(salesOrder);

      return salesOrder;
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "Rincian sales order gagal dimuat.",
      );

      return null;
    } finally {
      setIsLoadingSalesOrder(false);
    }
  };

  const handleCloseForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setDeliverableSalesOrders([]);
    setSelectedSalesOrder(null);
    setFormError("");
  };

  const handleCreateDelivery = async (
    payload,
  ) => {
    try {
      setIsSubmitting(true);
      setFormError("");

      await createDeliveryRequest(payload);

      setIsFormOpen(false);
      setDeliverableSalesOrders([]);
      setSelectedSalesOrder(null);
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "Pengiriman gagal ditambahkan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = async (
    deliveryId,
  ) => {
    try {
      setLoadingDetailId(deliveryId);
      setDetailError("");

      const detail =
        await getDeliveryByIdRequest(
          deliveryId,
        );

      setSelectedDelivery(detail);
      setIsDetailOpen(true);
    } catch (error) {
      setDetailError(
        error.response?.data?.message ||
          "Detail pengiriman gagal dimuat.",
      );
    } finally {
      setLoadingDetailId("");
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedDelivery(null);
  };

  const handleOpenStatusDialog = (
    delivery,
    nextStatus,
  ) => {
    if (!canManageDeliveries) {
      return;
    }

    setStatusDelivery(delivery);
    setNextDeliveryStatus(nextStatus);
    setStatusError("");
    setIsStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    if (isUpdatingStatus) {
      return;
    }

    setIsStatusDialogOpen(false);
    setStatusDelivery(null);
    setNextDeliveryStatus("");
    setStatusError("");
  };

  const handleConfirmStatus = async (
    nextStatus,
  ) => {
    if (!statusDelivery) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setStatusError("");

      await updateDeliveryStatusRequest(
        statusDelivery.id,
        nextStatus,
      );

      setIsStatusDialogOpen(false);
      setStatusDelivery(null);
      setNextDeliveryStatus("");
      setReloadKey((current) => current + 1);
    } catch (error) {
      setStatusError(
        error.response?.data?.message ||
          "Status pengiriman gagal diperbarui.",
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

  const dialogPresentation =
    statusDialogPresentation[
      nextDeliveryStatus
    ] || {
      title: "Perbarui status pengiriman?",
      nextStatusLabel: nextDeliveryStatus,
      confirmLabel: "Perbarui",
      tone: "success",
    };

  return (
    <div className="purchase-orders-page deliveries-page">
      <section className="page-heading">
        <div>
          <p>Sales &amp; Delivery</p>

          <h2>Deliveries</h2>

          <span>
            Kelola pengiriman barang, pengurangan stok,
            penerimaan customer, dan pemenuhan sales
            order.
          </span>
        </div>

        <div className="page-heading-actions">
          {canManageDeliveries && (
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
                  : "Tambah Delivery"}
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
          className="data-filters purchase-order-filters delivery-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              placeholder="Cari nomor delivery, SO, customer, atau penerima"
              aria-label="Cari pengiriman"
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
            options={deliveryStatusOptions}
            onChange={handleStatusChange}
            ariaLabel="Filter status pengiriman"
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
            <strong>{deliveries.length}</strong>{" "}
            dari{" "}
            <strong>
              {formatNumber(pagination.total)}
            </strong>{" "}
            pengiriman
          </p>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table purchase-order-table delivery-table">
            <thead>
              <tr>
                <th>Nomor delivery</th>
                <th>Sales order</th>
                <th>Customer</th>
                <th>Tanggal kirim</th>
                <th>Penerima</th>
                <th>Kuantitas</th>
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

                    Memuat data pengiriman...
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={8}
                  >
                    <Truck aria-hidden="true" />

                    Tidak ada pengiriman yang sesuai.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => {
                  const presentation =
                    statusPresentation[
                      delivery.status
                    ] ?? {
                      label: delivery.status,
                      className: "is-pending",
                    };

                  return (
                    <tr key={delivery.id}>
                      <td data-label="Nomor delivery">
                        <strong className="delivery-number">
                          {delivery.delivery_number}
                        </strong>
                      </td>

                      <td data-label="Sales order">
                        <strong className="delivery-sales-order">
                          {delivery.so_number}
                        </strong>
                      </td>

                      <td data-label="Customer">
                        <strong className="delivery-customer">
                          {delivery.customer_name}
                        </strong>

                        <span className="delivery-subtext">
                          {delivery.customer_code}
                        </span>
                      </td>

                      <td data-label="Tanggal kirim">
                        {formatDate(
                          delivery.delivery_date,
                        )}
                      </td>

                      <td data-label="Penerima">
                        {delivery.recipient_name ||
                          "-"}
                      </td>

                      <td data-label="Kuantitas">
                        <span className="purchase-order-items">
                          {formatNumber(
                            delivery.total_quantity,
                          )}{" "}
                          unit
                        </span>
                      </td>

                      <td data-label="Status">
                        <span
                          className={`delivery-status ${presentation.className}`}
                        >
                          {presentation.label}
                        </span>
                      </td>

                      <td
                        className="table-action-cell"
                        data-label="Aksi"
                      >
                        <div className="table-action-buttons delivery-action-buttons">
                          <button
                            type="button"
                            className="table-edit-action purchase-order-detail-action"
                            disabled={
                              Boolean(
                                loadingDetailId,
                              ) ||
                              isUpdatingStatus
                            }
                            onClick={() =>
                              handleOpenDetail(
                                delivery.id,
                              )
                            }
                          >
                            {loadingDetailId ===
                            delivery.id ? (
                              <RefreshCw
                                className="is-spinning"
                                aria-hidden="true"
                              />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}

                            Detail
                          </button>

                          {canManageDeliveries &&
                            delivery.status ===
                              "PENDING" && (
                              <button
                                type="button"
                                className="table-status-action is-activate"
                                disabled={
                                  Boolean(
                                    loadingDetailId,
                                  ) ||
                                  isUpdatingStatus
                                }
                                onClick={() =>
                                  handleOpenStatusDialog(
                                    delivery,
                                    "SHIPPED",
                                  )
                                }
                              >
                                <Truck aria-hidden="true" />

                                Kirim
                              </button>
                            )}

                          {canManageDeliveries &&
                            delivery.status ===
                              "SHIPPED" && (
                              <button
                                type="button"
                                className="table-status-action is-activate"
                                disabled={
                                  Boolean(
                                    loadingDetailId,
                                  ) ||
                                  isUpdatingStatus
                                }
                                onClick={() =>
                                  handleOpenStatusDialog(
                                    delivery,
                                    "DELIVERED",
                                  )
                                }
                              >
                                <CheckCircle2
                                  aria-hidden="true"
                                />

                                Diterima
                              </button>
                            )}

                          {canManageDeliveries &&
                            delivery.status ===
                              "PENDING" && (
                              <button
                                type="button"
                                className="table-status-action is-deactivate"
                                disabled={
                                  Boolean(
                                    loadingDetailId,
                                  ) ||
                                  isUpdatingStatus
                                }
                                onClick={() =>
                                  handleOpenStatusDialog(
                                    delivery,
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
        <DeliveryFormModal
          isOpen
          salesOrders={
            deliverableSalesOrders
          }
          selectedSalesOrder={
            selectedSalesOrder
          }
          isLoadingSalesOrder={
            isLoadingSalesOrder
          }
          isSubmitting={isSubmitting}
          requestError={formError}
          onClose={handleCloseForm}
          onSalesOrderChange={
            handleSalesOrderChange
          }
          onSubmit={handleCreateDelivery}
        />
      )}

      {isDetailOpen && (
        <DeliveryDetailDialog
          isOpen
          delivery={selectedDelivery}
          onClose={handleCloseDetail}
        />
      )}

      {isStatusDialogOpen &&
        statusDelivery && (
          <StatusConfirmDialog
            isOpen
            entityLabel="pengiriman"
            entityName={
              statusDelivery.customer_name
            }
            identifierLabel="nomor"
            identifierValue={
              statusDelivery.delivery_number
            }
            currentStatus={
              statusDelivery.status
            }
            nextStatus={nextDeliveryStatus}
            title={dialogPresentation.title}
            nextStatusLabel={
              dialogPresentation
                .nextStatusLabel
            }
            confirmLabel={
              dialogPresentation.confirmLabel
            }
            tone={dialogPresentation.tone}
            isSubmitting={isUpdatingStatus}
            requestError={statusError}
            onCancel={
              handleCloseStatusDialog
            }
            onConfirm={
              handleConfirmStatus
            }
          />
        )}
    </div>
  );
};

export default DeliveriesPage;