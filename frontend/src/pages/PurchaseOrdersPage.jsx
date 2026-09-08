import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  X,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  addSupplierPaymentProofsRequest,
  createSupplierPaymentRequest,
  createPurchaseOrderRequest,
  deleteSupplierPaymentProofRequest,
  decidePurchaseOrderApprovalRequest,
  getPurchaseOrderByIdRequest,
  getPurchaseOrdersRequest,
  openSupplierPaymentProofRequest,
  replaceSupplierPaymentProofRequest,
  submitPurchaseOrderApprovalRequest,
  updatePurchaseOrderStatusRequest,
} from "../api/purchaseOrders";
import { getPaymentSettingsRequest } from "../api/paymentSettings";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import ApprovalActionDialog from "../components/approvals/ApprovalActionDialog";
import StatusFilter from "../components/filters/StatusFilter";
import PurchaseOrderDetailDialog from "../components/purchase-orders/PurchaseOrderDetailDialog";
import PurchaseOrderStatusDialog from "../components/purchase-orders/PurchaseOrderStatusDialog";
import "../styles/purchase-orders.css";
import "../styles/payments.css";
import {
  getActiveProductsBySupplierRequest,
  getProductByIdRequest,
} from "../api/products";
import {
  getActiveSuppliersRequest,
  getSupplierByIdRequest,
} from "../api/suppliers";
import PurchaseOrderFormModal from "../components/purchase-orders/PurchaseOrderFormModal";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
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
    value: "PENDING_APPROVAL",
    label: "Menunggu persetujuan",
  },
  {
    value: "REJECTED_APPROVAL",
    label: "Ditolak",
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

const getStatusPresentation = (purchaseOrder) => {
  if (purchaseOrder.approval_status === "PENDING") {
    return { label: "Menunggu persetujuan", className: "is-pending" };
  }
  if (purchaseOrder.approval_status === "REJECTED") {
    return { label: "Ditolak", className: "is-rejected" };
  }
  return statusPresentation[purchaseOrder.status] ?? {
    label: purchaseOrder.status,
    className: "is-draft",
  };
};

const PurchaseOrdersPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const productRequestIdRef = useRef(0);

  const canManagePurchaseOrders = [
    "ADMIN",
    "PURCHASING",
  ].includes(user?.role);
  const canApprovePurchaseOrders = ["ADMIN", "MANAGER"].includes(user?.role);
  const canManageSupplierPayments = ["ADMIN", "FINANCE"].includes(
    user?.role,
  );
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
  const [initialProduct, setInitialProduct] =
    useState(null);
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
  const [paymentSettings, setPaymentSettings] = useState({});
  const [
    statusPurchaseOrder,
    setStatusPurchaseOrder,
  ] = useState(null);

  const [
    nextPurchaseOrderStatus,
    setNextPurchaseOrderStatus,
  ] = useState("");

  const [
    isStatusDialogOpen,
    setIsStatusDialogOpen,
  ] = useState(false);

  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState(false);

  const [statusError, setStatusError] =
    useState("");
  const [approvalPurchaseOrder, setApprovalPurchaseOrder] = useState(null);
  const [approvalAction, setApprovalAction] = useState("");
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isUpdatingApproval, setIsUpdatingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState("");

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
          ...(dateFrom && {
            date_from: dateFrom,
          }),
          ...(dateTo && {
            date_to: dateTo,
          }),
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
  }, [
    page,
    appliedSearch,
    status,
    dateFrom,
    dateTo,
    reloadKey,
  ]);

  const prefillProductId =
    location.state?.purchaseOrderPrefill?.productId;
  const prefillSupplierId =
    location.state?.purchaseOrderPrefill?.supplierId;

  useEffect(() => {
    if (
      !canManagePurchaseOrders ||
      !prefillProductId ||
      !prefillSupplierId
    ) {
      return undefined;
    }

    let isCancelled = false;

    const preparePrefilledForm = async () => {
      try {
        setIsPreparingForm(true);
        setActionError("");
        setFormError("");
        setFormProducts([]);
        setInitialProduct(null);

        const [
          supplierData,
          productData,
          selectedSupplier,
          selectedProduct,
          settingsData,
        ] =
          await Promise.all([
            getActiveSuppliersRequest(),
            getActiveProductsBySupplierRequest(
              prefillSupplierId,
            ),
            getSupplierByIdRequest(prefillSupplierId),
            getProductByIdRequest(prefillProductId),
            getPaymentSettingsRequest(),
          ]);

        if (isCancelled) {
          return;
        }

        if (selectedSupplier.status !== "ACTIVE") {
          throw new Error(
            "Supplier produk tidak aktif atau tidak tersedia.",
          );
        }

        if (
          selectedProduct.status !== "ACTIVE" ||
          selectedProduct.supplier_id !==
            prefillSupplierId
        ) {
          throw new Error(
            "Produk tidak aktif atau tidak tersedia untuk purchase order.",
          );
        }

        const availableSuppliers = supplierData.some(
          (supplier) => supplier.id === selectedSupplier.id,
        )
          ? supplierData
          : [...supplierData, selectedSupplier];
        const availableProducts = productData.some(
          (product) => product.id === selectedProduct.id,
        )
          ? productData
          : [...productData, selectedProduct];

        setSuppliers(availableSuppliers);
        setFormProducts(availableProducts);
        setInitialProduct(selectedProduct);
        setPaymentSettings(settingsData);
        setIsFormOpen(true);
      } catch (error) {
        if (!isCancelled) {
          setActionError(
            error.response?.data?.message ||
              error.message ||
              "Form purchase order gagal disiapkan.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsPreparingForm(false);
          navigate(location.pathname, {
            replace: true,
            state: null,
          });
        }
      }
    };

    preparePrefilledForm();

    return () => {
      isCancelled = true;
    };
  }, [
    canManagePurchaseOrders,
    location.pathname,
    navigate,
    prefillProductId,
    prefillSupplierId,
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
    if (!canManagePurchaseOrders) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");
      setFormProducts([]);
      setInitialProduct(null);

      const [supplierData, settingsData] = await Promise.all([
        getActiveSuppliersRequest(),
        getPaymentSettingsRequest(),
      ]);

      setSuppliers(supplierData);
      setPaymentSettings(settingsData);
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
    setInitialProduct(null);
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
      setInitialProduct(null);
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

      const [detail, settingsData] = await Promise.all([
        getPurchaseOrderByIdRequest(purchaseOrderId),
        getPaymentSettingsRequest(),
      ]);

      setSelectedPurchaseOrder(detail);
      setPaymentSettings(settingsData);
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

  const refreshSelectedPurchaseOrder = async () => {
    const detail = await getPurchaseOrderByIdRequest(
      selectedPurchaseOrder.id,
    );
    setSelectedPurchaseOrder(detail);
    setReloadKey((current) => current + 1);
    return detail;
  };

  const handleCreateSupplierPayment = async (payload) => {
    await createSupplierPaymentRequest(selectedPurchaseOrder.id, payload);
    await refreshSelectedPurchaseOrder();
  };

  const updateSupplierPaymentProofs = (paymentId, proofs) => {
    setSelectedPurchaseOrder((current) => ({
      ...current,
      supplier_payments: current.supplier_payments.map((payment) =>
        payment.id === paymentId ? { ...payment, proofs } : payment,
      ),
    }));
  };

  const handleAddSupplierProofs = async (paymentId, files) => {
    const proofs = await addSupplierPaymentProofsRequest(
      selectedPurchaseOrder.id,
      paymentId,
      files,
    );
    updateSupplierPaymentProofs(paymentId, proofs);
  };

  const handleReplaceSupplierProof = async (paymentId, proofId, file) => {
    const proofs = await replaceSupplierPaymentProofRequest(
      selectedPurchaseOrder.id,
      paymentId,
      proofId,
      file,
    );
    updateSupplierPaymentProofs(paymentId, proofs);
  };

  const handleDeleteSupplierProof = async (paymentId, proofId) => {
    const proofs = await deleteSupplierPaymentProofRequest(
      selectedPurchaseOrder.id,
      paymentId,
      proofId,
    );
    updateSupplierPaymentProofs(paymentId, proofs);
  };

  const handleOpenStatusDialog = (
    purchaseOrder,
    nextStatus,
  ) => {
    if (!canManagePurchaseOrders) {
      return;
    }

    setStatusPurchaseOrder(purchaseOrder);
    setNextPurchaseOrderStatus(nextStatus);
    setStatusError("");
    setIsStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    if (isUpdatingStatus) {
      return;
    }

    setIsStatusDialogOpen(false);
    setStatusPurchaseOrder(null);
    setNextPurchaseOrderStatus("");
    setStatusError("");
  };

  const handleConfirmStatus = async (
    nextStatus,
  ) => {
    if (!statusPurchaseOrder) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setStatusError("");

      await updatePurchaseOrderStatusRequest(
        statusPurchaseOrder.id,
        nextStatus,
      );

      setIsStatusDialogOpen(false);
      setStatusPurchaseOrder(null);
      setNextPurchaseOrderStatus("");
      setReloadKey((current) => current + 1);
    } catch (error) {
      setStatusError(
        error.response?.data?.message ||
        "Status purchase order gagal diperbarui.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleOpenApprovalDialog = (purchaseOrder, action) => {
    setApprovalPurchaseOrder(purchaseOrder);
    setApprovalAction(action);
    setApprovalError("");
    setIsApprovalDialogOpen(true);
  };

  const handleCloseApprovalDialog = () => {
    if (isUpdatingApproval) return;
    setIsApprovalDialogOpen(false);
    setApprovalPurchaseOrder(null);
    setApprovalAction("");
    setApprovalError("");
  };

  const handleConfirmApproval = async ({ action, reason }) => {
    if (!approvalPurchaseOrder) return;
    try {
      setIsUpdatingApproval(true);
      setApprovalError("");
      if (action === "SUBMIT") {
        await submitPurchaseOrderApprovalRequest(approvalPurchaseOrder.id);
      } else {
        await decidePurchaseOrderApprovalRequest(
          approvalPurchaseOrder.id,
          action === "APPROVE" ? "APPROVED" : "REJECTED",
          reason,
        );
      }
      setIsApprovalDialogOpen(false);
      setApprovalPurchaseOrder(null);
      setApprovalAction("");
      setReloadKey((current) => current + 1);
    } catch (error) {
      setApprovalError(
        error.response?.data?.message || "Proses persetujuan purchase order gagal.",
      );
    } finally {
      setIsUpdatingApproval(false);
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
          ref={filtersRef}
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
                  const presentation = getStatusPresentation(purchaseOrder);

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
                        <div className="table-action-buttons purchase-order-action-buttons">
                          <button
                            type="button"
                            className="table-edit-action purchase-order-detail-action"
                            disabled={
                              Boolean(loadingDetailId) ||
                              isUpdatingStatus || isUpdatingApproval
                            }
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

                          {canManagePurchaseOrders &&
                            purchaseOrder.status === "DRAFT" &&
                            purchaseOrder.approval_status !== "PENDING" && (
                              <button
                                type="button"
                                className="table-status-action is-activate"
                                disabled={
                                  Boolean(loadingDetailId) ||
                                  isUpdatingStatus || isUpdatingApproval
                                }
                                onClick={() =>
                                  handleOpenApprovalDialog(
                                    purchaseOrder,
                                    "SUBMIT",
                                  )
                                }
                              >
                                <Send aria-hidden="true" />
                                Ajukan
                              </button>
                            )}

                          {canApprovePurchaseOrders &&
                            purchaseOrder.approval_status === "PENDING" &&
                            purchaseOrder.submitted_by !== user?.id && (
                              <>
                                <button
                                  type="button"
                                  className="table-status-action is-activate"
                                  disabled={Boolean(loadingDetailId) || isUpdatingApproval}
                                  onClick={() => handleOpenApprovalDialog(purchaseOrder, "APPROVE")}
                                >
                                  <CheckCircle2 aria-hidden="true" /> Setujui
                                </button>
                                <button
                                  type="button"
                                  className="table-status-action is-deactivate"
                                  disabled={Boolean(loadingDetailId) || isUpdatingApproval}
                                  onClick={() => handleOpenApprovalDialog(purchaseOrder, "REJECT")}
                                >
                                  <XCircle aria-hidden="true" /> Tolak
                                </button>
                              </>
                            )}

                          {canManagePurchaseOrders &&
                            ["DRAFT", "SUBMITTED"].includes(
                              purchaseOrder.status,
                            ) && (
                              <button
                                type="button"
                                className="table-status-action is-deactivate"
                                disabled={
                                  Boolean(loadingDetailId) ||
                                  isUpdatingStatus || isUpdatingApproval
                                }
                                onClick={() =>
                                  handleOpenStatusDialog(
                                    purchaseOrder,
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
        <PurchaseOrderFormModal
          key={initialProduct?.id ?? "create"}
          isOpen
          suppliers={suppliers}
          products={formProducts}
          initialSupplierId={
            initialProduct?.supplier_id ?? ""
          }
          initialProduct={initialProduct}
          paymentSettings={paymentSettings}
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
          canManageSupplierPayments={canManageSupplierPayments}
          requireTransferProof={Boolean(
            paymentSettings.require_purchase_transfer_proof,
          )}
          onCreateSupplierPayment={handleCreateSupplierPayment}
          onAddSupplierProofs={handleAddSupplierProofs}
          onReplaceSupplierProof={handleReplaceSupplierProof}
          onDeleteSupplierProof={handleDeleteSupplierProof}
          onOpenSupplierProof={(paymentId, proofId) =>
            openSupplierPaymentProofRequest(
              selectedPurchaseOrder.id,
              paymentId,
              proofId,
            )
          }
          onClose={handleCloseDetail}
        />
      )}
      {isStatusDialogOpen && (
        <PurchaseOrderStatusDialog
          isOpen
          purchaseOrder={statusPurchaseOrder}
          nextStatus={nextPurchaseOrderStatus}
          isSubmitting={isUpdatingStatus}
          requestError={statusError}
          onCancel={handleCloseStatusDialog}
          onConfirm={handleConfirmStatus}
        />
      )}
      {isApprovalDialogOpen && approvalPurchaseOrder && (
        <ApprovalActionDialog
          isOpen
          action={approvalAction}
          transactionLabel="Purchase order"
          transactionNumber={approvalPurchaseOrder.po_number}
          isSubmitting={isUpdatingApproval}
          requestError={approvalError}
          onCancel={handleCloseApprovalDialog}
          onConfirm={handleConfirmApproval}
        />
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
