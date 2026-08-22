import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createPurchaseOrderRequest,
  getPurchaseOrderByIdRequest,
  getPurchaseOrdersRequest,
} from "../api/purchaseOrders";
import StatusFilter from "../components/filters/StatusFilter";
import PurchaseOrderDetailDialog from "../components/purchase-orders/PurchaseOrderDetailDialog";
import "../styles/purchase-orders.css";
import { getActiveProductsBySupplierRequest } from "../api/products";
import { getActiveSuppliersRequest } from "../api/suppliers";
import PurchaseOrderFormModal from "../components/purchase-orders/PurchaseOrderFormModal";
import useAuth from "../hooks/useAuth";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../utils/formatters";

const PAGE_LIMIT = 10;

const purchaseOrderStatusOptions = [
  {
    value: "",
    label: "Semua status",
  },
  {
    value: "DRAFT",
    label: "Draft",
  },
  {
    value: "SUBMITTED",
    label: "Diajukan",
  },
  {
    value: "PARTIALLY_RECEIVED",
    label: "Diterima sebagian",
  },
  {
    value: "RECEIVED",
    label: "Diterima",
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
  SUBMITTED: {
    label: "Diajukan",
    className: "is-submitted",
  },
  PARTIALLY_RECEIVED: {
    label: "Diterima sebagian",
    className: "is-partially-received",
  },
  RECEIVED: {
    label: "Diterima",
    className: "is-received",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "is-cancelled",
  },
};

const PurchaseOrdersPage = () => {
  const { user } = useAuth();
  const productRequestIdRef = useRef(0);

  const canManagePurchaseOrders = [
    "ADMIN",
    "PURCHASING",
  ].includes(user?.role);
  const [purchaseOrders, setPurchaseOrders] =
    useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    total_pages: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] =
    useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] =
    useState(null);
  const [isDetailOpen, setIsDetailOpen] =
    useState(false);
  const [loadingDetailId, setLoadingDetailId] =
    useState("");
  const [detailError, setDetailError] =
    useState("");
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [suppliers, setSuppliers] =
    useState([]);
  const [formProducts, setFormProducts] =
    useState([]);
  const [isPreparingForm, setIsPreparingForm] =
    useState(false);
  const [isLoadingProducts, setIsLoadingProducts] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [formError, setFormError] =
    useState("");
  const [actionError, setActionError] =
    useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchPurchaseOrders = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await getPurchaseOrdersRequest({
          page,
          limit: PAGE_LIMIT,
          ...(appliedSearch && {
            search: appliedSearch,
          }),
          ...(status && { status }),
        });

        if (!isCancelled) {
          setPurchaseOrders(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setPurchaseOrders([]);
          setPagination({
            page,
            limit: PAGE_LIMIT,
            total: 0,
            total_pages: 0,
          });
          setErrorMessage(
            error.response?.data?.message ||
            "Purchase order gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPurchaseOrders();

    return () => {
      isCancelled = true;
    };
  }, [page, appliedSearch, status, reloadKey]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleStatusChange = (nextStatus) => {
    setPage(1);
    setStatus(nextStatus);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setStatus("");
    setPage(1);
  };

  const handleOpenCreateForm = async () => {
    if (!canManagePurchaseOrders) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");
      setFormProducts([]);

      const supplierData =
        await getActiveSuppliersRequest();

      setSuppliers(supplierData);
      setIsFormOpen(true);
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
        "Supplier aktif gagal dimuat.",
      );
    } finally {
      setIsPreparingForm(false);
    }
  };

  const handleSupplierChange = async (supplierId) => {
    const requestId =
      productRequestIdRef.current + 1;

    productRequestIdRef.current = requestId;
    setFormProducts([]);
    setFormError("");

    if (!supplierId) {
      setIsLoadingProducts(false);
      return;
    }

    try {
      setIsLoadingProducts(true);

      const productData =
        await getActiveProductsBySupplierRequest(
          supplierId,
        );

      if (productRequestIdRef.current === requestId) {
        setFormProducts(productData);
      }
    } catch (error) {
      if (productRequestIdRef.current === requestId) {
        setFormError(
          error.response?.data?.message ||
          "Produk supplier gagal dimuat.",
        );
      }
    } finally {
      if (productRequestIdRef.current === requestId) {
        setIsLoadingProducts(false);
      }
    }
  };

  const handleCloseForm = () => {
    if (isSubmitting) {
      return;
    }

    productRequestIdRef.current += 1;
    setIsFormOpen(false);
    setSuppliers([]);
    setFormProducts([]);
    setIsLoadingProducts(false);
    setFormError("");
  };

  const handleCreatePurchaseOrder = async (payload) => {
    try {
      setIsSubmitting(true);
      setFormError("");

      await createPurchaseOrderRequest(payload);

      setIsFormOpen(false);
      setSuppliers([]);
      setFormProducts([]);
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
        "Purchase order gagal ditambahkan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = async (purchaseOrderId) => {
    try {
      setLoadingDetailId(purchaseOrderId);
      setDetailError("");

      const detail =
        await getPurchaseOrderByIdRequest(
          purchaseOrderId,
        );

      setSelectedPurchaseOrder(detail);
      setIsDetailOpen(true);
    } catch (error) {
      setDetailError(
        error.response?.data?.message ||
        "Detail purchase order gagal dimuat.",
      );
    } finally {
      setLoadingDetailId("");
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedPurchaseOrder(null);
  };

  const totalPages = Math.max(
    pagination.total_pages,
    1,
  );

  const hasActiveFilters =
    Boolean(appliedSearch) || Boolean(status);

  return (
    <div className="purchase-orders-page">
      <section className="page-heading">
        <div>
          <p>Purchasing &amp; Inventory</p>
          <h2>Purchase Orders</h2>
          <span>
            Pantau pesanan pembelian, supplier, jadwal,
            dan proses penerimaan barang.
          </span>
        </div>

        <div className="page-heading-actions">
          {canManagePurchaseOrders && (
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
                  : "Tambah PO"}
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
          className="data-filters purchase-order-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              placeholder="Cari nomor PO, supplier, atau catatan"
              aria-label="Cari purchase order"
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />

            <button type="submit">Cari</button>
          </div>

          <StatusFilter
            value={status}
            options={purchaseOrderStatusOptions}
            onChange={handleStatusChange}
            ariaLabel="Filter status purchase order"
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
            <strong>{purchaseOrders.length}</strong> dari{" "}
            <strong>
              {formatNumber(pagination.total)}
            </strong>{" "}
            purchase order
          </p>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table purchase-order-table">
            <thead>
              <tr>
                <th>Nomor PO</th>
                <th>Supplier</th>
                <th>Tanggal pesan</th>
                <th>Estimasi tiba</th>
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
                    Memuat purchase order...
                  </td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td className="table-message" colSpan={8}>
                    <ShoppingCart aria-hidden="true" />
                    Tidak ada purchase order yang sesuai.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((purchaseOrder) => {
                  const presentation =
                    statusPresentation[
                    purchaseOrder.status
                    ] ?? {
                      label: purchaseOrder.status,
                      className: "is-draft",
                    };

                  return (
                    <tr key={purchaseOrder.id}>
                      <td data-label="Nomor PO">
                        <strong className="purchase-order-number">
                          {purchaseOrder.po_number}
                        </strong>
                      </td>

                      <td data-label="Supplier">
                        <strong className="purchase-order-supplier">
                          {purchaseOrder.supplier_name}
                        </strong>
                        <span className="purchase-order-subtext">
                          {purchaseOrder.supplier_code}
                        </span>
                      </td>

                      <td data-label="Tanggal pesan">
                        {formatDate(purchaseOrder.order_date)}
                      </td>

                      <td data-label="Estimasi tiba">
                        {formatDate(
                          purchaseOrder.expected_date,
                        )}
                      </td>

                      <td data-label="Item">
                        <span className="purchase-order-items">
                          {formatNumber(
                            purchaseOrder.total_items,
                          )}{" "}
                          item
                        </span>
                      </td>

                      <td data-label="Total">
                        <strong className="purchase-order-total">
                          {formatCurrency(
                            purchaseOrder.total_amount,
                          )}
                        </strong>
                      </td>

                      <td data-label="Status">
                        <span
                          className={`purchase-order-status ${presentation.className}`}
                        >
                          {presentation.label}
                        </span>
                      </td>
                      <td
                        className="table-action-cell"
                        data-label="Aksi"
                      >
                        <button
                          type="button"
                          className="table-edit-action purchase-order-detail-action"
                          disabled={Boolean(loadingDetailId)}
                          onClick={() =>
                            handleOpenDetail(purchaseOrder.id)
                          }
                        >
                          {loadingDetailId === purchaseOrder.id ? (
                            <RefreshCw
                              className="is-spinning"
                              aria-hidden="true"
                            />
                          ) : (
                            <Eye aria-hidden="true" />
                          )}

                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <p>
            Halaman <strong>{pagination.page}</strong>{" "}
            dari <strong>{totalPages}</strong>
          </p>

          <div>
            <button
              type="button"
              aria-label="Halaman sebelumnya"
              disabled={page <= 1 || isLoading}
              onClick={() =>
                setPage((current) =>
                  Math.max(current - 1, 1),
                )
              }
            >
              <ChevronLeft aria-hidden="true" />
              Sebelumnya
            </button>

            <button
              type="button"
              aria-label="Halaman berikutnya"
              disabled={page >= totalPages || isLoading}
              onClick={() =>
                setPage((current) =>
                  Math.min(current + 1, totalPages),
                )
              }
            >
              Berikutnya
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
      {isFormOpen && (
        <PurchaseOrderFormModal
          isOpen
          suppliers={suppliers}
          products={formProducts}
          isLoadingProducts={isLoadingProducts}
          isSubmitting={isSubmitting}
          requestError={formError}
          onClose={handleCloseForm}
          onSupplierChange={handleSupplierChange}
          onSubmit={handleCreatePurchaseOrder}
        />
      )}
      {isDetailOpen && (
        <PurchaseOrderDetailDialog
          isOpen
          purchaseOrder={selectedPurchaseOrder}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
