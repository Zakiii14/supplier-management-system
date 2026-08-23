import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Eye,
    PackageOpen,
    RefreshCw,
    Search,
    Plus,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
    createGoodsReceiptRequest,
    getGoodsReceiptByIdRequest,
    getGoodsReceiptsRequest,
} from "../api/goodsReceipts";
import "../styles/goods-receipts.css";
import {
    formatDate,
    formatNumber,
} from "../utils/formatters";
import GoodsReceiptDetailDialog from "../components/goods-receipts/GoodsReceiptDetailDialog";
import {
    getPurchaseOrderByIdRequest,
    getReceivablePurchaseOrdersRequest,
} from "../api/purchaseOrders";
import GoodsReceiptFormModal from "../components/goods-receipts/GoodsReceiptFormModal";
import useAuth from "../hooks/useAuth";

const PAGE_LIMIT = 10;

const purchaseOrderStatusLabels = {
    DRAFT: "Draft",
    SUBMITTED: "Diajukan",
    PARTIALLY_RECEIVED: "Diterima sebagian",
    RECEIVED: "Diterima",
    CANCELLED: "Dibatalkan",
};

const GoodsReceiptsPage = () => {
    const { user } = useAuth();

    const canCreateGoodsReceipt = [
        "ADMIN",
        "WAREHOUSE",
    ].includes(user?.role);
    const [goodsReceipts, setGoodsReceipts] =
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

    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);
    const [isLoading, setIsLoading] =
        useState(true);

    const [errorMessage, setErrorMessage] =
        useState("");

    const [
        selectedGoodsReceipt,
        setSelectedGoodsReceipt,
    ] = useState(null);

    const [isDetailOpen, setIsDetailOpen] =
        useState(false);

    const [loadingDetailId, setLoadingDetailId] =
        useState("");

    const [detailError, setDetailError] =
        useState("");

    const [isFormOpen, setIsFormOpen] =
        useState(false);

    const [purchaseOrders, setPurchaseOrders] =
        useState([]);

    const [
        selectedPurchaseOrder,
        setSelectedPurchaseOrder,
    ] = useState(null);

    const [isPreparingForm, setIsPreparingForm] =
        useState(false);

    const [
        isLoadingPurchaseOrder,
        setIsLoadingPurchaseOrder,
    ] = useState(false);

    const [isSubmitting, setIsSubmitting] =
        useState(false);

    const [formError, setFormError] =
        useState("");

    const [actionError, setActionError] =
        useState("");

    useEffect(() => {
        let isCancelled = false;

        const fetchGoodsReceipts = async () => {
            try {
                setIsLoading(true);
                setErrorMessage("");

                const response =
                    await getGoodsReceiptsRequest({
                        page,
                        limit: PAGE_LIMIT,
                        ...(appliedSearch && {
                            search: appliedSearch,
                        }),
                    });

                if (!isCancelled) {
                    setGoodsReceipts(response.data);
                    setPagination(response.pagination);
                }
            } catch (error) {
                if (!isCancelled) {
                    setGoodsReceipts([]);
                    setPagination({
                        page,
                        limit: PAGE_LIMIT,
                        total: 0,
                        total_pages: 0,
                    });

                    setErrorMessage(
                        error.response?.data?.message ||
                        "Penerimaan barang gagal dimuat. Silakan coba kembali.",
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchGoodsReceipts();

        return () => {
            isCancelled = true;
        };
    }, [page, appliedSearch, reloadKey]);

    const handleSearch = (event) => {
        event.preventDefault();
        setPage(1);
        setAppliedSearch(searchInput.trim());
    };

    const handleResetFilters = () => {
        setSearchInput("");
        setAppliedSearch("");
        setPage(1);
    };

    const handleOpenDetail = async (
        goodsReceipt,
    ) => {
        try {
            setLoadingDetailId(goodsReceipt.id);
            setDetailError("");

            const detail =
                await getGoodsReceiptByIdRequest(
                    goodsReceipt.id,
                );

            setSelectedGoodsReceipt({
                ...goodsReceipt,
                ...detail,
            });

            setIsDetailOpen(true);
        } catch (error) {
            setDetailError(
                error.response?.data?.message ||
                "Detail penerimaan barang gagal dimuat.",
            );
        } finally {
            setLoadingDetailId("");
        }
    };

    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        setSelectedGoodsReceipt(null);
    };

    const handleOpenCreateForm = async () => {
        if (!canCreateGoodsReceipt) {
            return;
        }

        try {
            setIsPreparingForm(true);
            setActionError("");
            setFormError("");
            setSelectedPurchaseOrder(null);

            const data =
                await getReceivablePurchaseOrdersRequest();

            setPurchaseOrders(data);
            setIsFormOpen(true);
        } catch (error) {
            setActionError(
                error.response?.data?.message ||
                "Purchase order yang dapat diterima gagal dimuat.",
            );
        } finally {
            setIsPreparingForm(false);
        }
    };

    const handlePurchaseOrderChange = async (
        purchaseOrderId,
    ) => {
        setSelectedPurchaseOrder(null);
        setFormError("");

        if (!purchaseOrderId) {
            return null;
        }

        try {
            setIsLoadingPurchaseOrder(true);

            const detail =
                await getPurchaseOrderByIdRequest(
                    purchaseOrderId,
                );

            if (
                ![
                    "SUBMITTED",
                    "PARTIALLY_RECEIVED",
                ].includes(detail.status)
            ) {
                setFormError(
                    "Purchase order ini sudah tidak dapat menerima barang.",
                );
                return null;
            }

            setSelectedPurchaseOrder(detail);
            return detail;
        } catch (error) {
            setFormError(
                error.response?.data?.message ||
                "Rincian purchase order gagal dimuat.",
            );

            return null;
        } finally {
            setIsLoadingPurchaseOrder(false);
        }
    };

    const handleCloseForm = () => {
        if (isSubmitting) {
            return;
        }

        setIsFormOpen(false);
        setPurchaseOrders([]);
        setSelectedPurchaseOrder(null);
        setIsLoadingPurchaseOrder(false);
        setFormError("");
    };

    const handleCreateGoodsReceipt = async (
        payload,
    ) => {
        try {
            setIsSubmitting(true);
            setFormError("");

            await createGoodsReceiptRequest(payload);

            setIsFormOpen(false);
            setPurchaseOrders([]);
            setSelectedPurchaseOrder(null);
            setPage(1);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setFormError(
                error.response?.data?.message ||
                "Penerimaan barang gagal disimpan.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalPages = Math.max(
        pagination.total_pages,
        1,
    );

    return (
        <div className="goods-receipts-page">
            <section className="page-heading">
                <div>
                    <p>Purchasing &amp; Inventory</p>
                    <h2>Goods Receipts</h2>
                    <span>
                        Pantau penerimaan barang, jumlah rusak,
                        supplier, dan purchase order terkait.
                    </span>
                </div>

                <div className="page-heading-actions">
                    {canCreateGoodsReceipt && (
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
                                    : "Tambah penerimaan"}
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
                    className="goods-receipt-action-error"
                    role="alert"
                >
                    <AlertTriangle aria-hidden="true" />
                    <span>{actionError}</span>
                </div>
            )}

            <section className="data-panel">
                <form
                    className="data-filters goods-receipt-filters"
                    onSubmit={handleSearch}
                >
                    <div className="search-control">
                        <Search aria-hidden="true" />

                        <input
                            type="search"
                            value={searchInput}
                            placeholder="Cari nomor penerimaan, PO, supplier, atau penerima"
                            aria-label="Cari penerimaan barang"
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                        />

                        <button type="submit">Cari</button>
                    </div>

                    {appliedSearch && (
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
                        <strong>{goodsReceipts.length}</strong>{" "}
                        dari{" "}
                        <strong>
                            {formatNumber(pagination.total)}
                        </strong>{" "}
                        penerimaan barang
                    </p>
                </div>

                <div className="data-table-wrapper">
                    <table className="data-table goods-receipt-table">
                        <thead>
                            <tr>
                                <th>Nomor penerimaan</th>
                                <th>Purchase order</th>
                                <th>Supplier</th>
                                <th>Tanggal terima</th>
                                <th>Item</th>
                                <th>Diterima</th>
                                <th>Rusak</th>
                                <th>Penerima</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>

                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={9}
                                    >
                                        <RefreshCw
                                            className="is-spinning"
                                            aria-hidden="true"
                                        />
                                        Memuat penerimaan barang...
                                    </td>
                                </tr>
                            ) : goodsReceipts.length === 0 ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={9}
                                    >
                                        <PackageOpen aria-hidden="true" />
                                        Tidak ada penerimaan barang yang
                                        sesuai.
                                    </td>
                                </tr>
                            ) : (
                                goodsReceipts.map((goodsReceipt) => (
                                    <tr key={goodsReceipt.id}>
                                        <td data-label="Nomor penerimaan">
                                            <strong className="goods-receipt-number">
                                                {goodsReceipt.receipt_number}
                                            </strong>
                                        </td>

                                        <td data-label="Purchase order">
                                            <strong className="goods-receipt-po">
                                                {goodsReceipt.po_number}
                                            </strong>

                                            <span className="goods-receipt-subtext">
                                                {purchaseOrderStatusLabels[
                                                    goodsReceipt
                                                        .purchase_order_status
                                                ] ||
                                                    goodsReceipt
                                                        .purchase_order_status}
                                            </span>
                                        </td>

                                        <td data-label="Supplier">
                                            <strong className="goods-receipt-supplier">
                                                {goodsReceipt.supplier_name}
                                            </strong>

                                            <span className="goods-receipt-subtext">
                                                {goodsReceipt.supplier_code}
                                            </span>
                                        </td>

                                        <td data-label="Tanggal terima">
                                            {formatDate(
                                                goodsReceipt.received_date,
                                            )}
                                        </td>

                                        <td data-label="Item">
                                            {formatNumber(
                                                goodsReceipt.total_items,
                                            )}{" "}
                                            item
                                        </td>

                                        <td data-label="Diterima">
                                            <strong className="goods-receipt-quantity">
                                                {formatNumber(
                                                    goodsReceipt
                                                        .total_quantity_received,
                                                )}
                                            </strong>
                                        </td>

                                        <td data-label="Rusak">
                                            <strong
                                                className={`goods-receipt-damaged ${Number(
                                                    goodsReceipt
                                                        .total_quantity_damaged,
                                                ) > 0
                                                    ? "has-damage"
                                                    : ""
                                                    }`}
                                            >
                                                {formatNumber(
                                                    goodsReceipt
                                                        .total_quantity_damaged,
                                                )}
                                            </strong>
                                        </td>

                                        <td data-label="Penerima">
                                            <span className="goods-receipt-receiver">
                                                {goodsReceipt.received_by_name ||
                                                    "-"}
                                            </span>
                                        </td>

                                        <td
                                            className="table-action-cell"
                                            data-label="Aksi"
                                        >
                                            <button
                                                type="button"
                                                className="table-edit-action goods-receipt-detail-action"
                                                disabled={Boolean(loadingDetailId)}
                                                onClick={() =>
                                                    handleOpenDetail(goodsReceipt)
                                                }
                                            >
                                                {loadingDetailId === goodsReceipt.id ? (
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination-bar">
                    <p>
                        Halaman <strong>{page}</strong> dari{" "}
                        <strong>{totalPages}</strong>
                    </p>

                    <div>
                        <button
                            type="button"
                            disabled={isLoading || page <= 1}
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
                            disabled={
                                isLoading ||
                                pagination.total_pages === 0 ||
                                page >= pagination.total_pages
                            }
                            onClick={() =>
                                setPage((current) =>
                                    Math.min(
                                        current + 1,
                                        totalPages,
                                    ),
                                )
                            }
                        >
                            Berikutnya
                            <ChevronRight aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </section>
            {isDetailOpen && (
                <GoodsReceiptDetailDialog
                    isOpen
                    goodsReceipt={selectedGoodsReceipt}
                    onClose={handleCloseDetail}
                />
            )}
            {isFormOpen && (
                <GoodsReceiptFormModal
                    isOpen
                    purchaseOrders={purchaseOrders}
                    selectedPurchaseOrder={
                        selectedPurchaseOrder
                    }
                    isLoadingPurchaseOrder={
                        isLoadingPurchaseOrder
                    }
                    isSubmitting={isSubmitting}
                    requestError={formError}
                    onClose={handleCloseForm}
                    onPurchaseOrderChange={
                        handlePurchaseOrderChange
                    }
                    onSubmit={handleCreateGoodsReceipt}
                />
            )}
        </div>
    );
};

export default GoodsReceiptsPage;