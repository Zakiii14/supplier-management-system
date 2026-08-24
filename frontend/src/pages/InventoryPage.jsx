import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Eye,
    RefreshCw,
    Search,
    Warehouse,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
    getInventoryMovementByIdRequest,
    getInventoryMovementsRequest,
} from "../api/inventoryMovements";
import StatusFilter from "../components/filters/StatusFilter";
import InventoryMovementDetailDialog from "../components/inventory/InventoryMovementDetailDialog";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/inventory.css";
import { formatNumber } from "../utils/formatters";

const PAGE_LIMIT = 10;

const movementTypeOptions = [
    {
        value: "",
        label: "Semua pergerakan",
    },
    {
        value: "PURCHASE_RECEIPT",
        label: "Penerimaan pembelian",
    },
    {
        value: "SALES_ISSUE",
        label: "Pengeluaran penjualan",
    },
    {
        value: "ADJUSTMENT_IN",
        label: "Penyesuaian masuk",
    },
    {
        value: "ADJUSTMENT_OUT",
        label: "Penyesuaian keluar",
    },
    {
        value: "RETURN_IN",
        label: "Retur masuk",
    },
    {
        value: "RETURN_OUT",
        label: "Retur keluar",
    },
];

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
        month: "short",
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

const InventoryPage = () => {
    const filtersRef = useStickyDataFilters();
    const [inventoryMovements, setInventoryMovements] =
        useState([]);

    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_LIMIT,
        total_data: 0,
        total_pages: 0,
    });

    const [searchInput, setSearchInput] =
        useState("");

    const [appliedSearch, setAppliedSearch] =
        useState("");

    const [movementType, setMovementType] =
        useState("");

    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);
    const [isLoading, setIsLoading] =
        useState(true);

    const [errorMessage, setErrorMessage] =
        useState("");
    const [
        selectedInventoryMovement,
        setSelectedInventoryMovement,
    ] = useState(null);

    const [isDetailOpen, setIsDetailOpen] =
        useState(false);

    const [loadingDetailId, setLoadingDetailId] =
        useState("");

    const [detailError, setDetailError] =
        useState("");

    useEffect(() => {
        let isCancelled = false;

        const fetchInventoryMovements = async () => {
            try {
                setIsLoading(true);
                setErrorMessage("");

                const response =
                    await getInventoryMovementsRequest({
                        page,
                        limit: PAGE_LIMIT,
                        ...(appliedSearch && {
                            search: appliedSearch,
                        }),
                        ...(movementType && {
                            movement_type: movementType,
                        }),
                        ...(dateFrom && {
                            date_from: dateFrom,
                        }),
                        ...(dateTo && {
                            date_to: dateTo,
                        }),
                    });

                if (!isCancelled) {
                    setInventoryMovements(response.data);
                    setPagination(response.pagination);
                }
            } catch (error) {
                if (!isCancelled) {
                    setInventoryMovements([]);

                    setPagination({
                        page,
                        limit: PAGE_LIMIT,
                        total_data: 0,
                        total_pages: 0,
                    });

                    setErrorMessage(
                        error.response?.data?.message ||
                        "Pergerakan inventory gagal dimuat. Silakan coba kembali.",
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchInventoryMovements();

        return () => {
            isCancelled = true;
        };
    }, [
        page,
        appliedSearch,
        movementType,
        dateFrom,
        dateTo,
        reloadKey,
    ]);

    const handleSearch = (event) => {
        event.preventDefault();
        setPage(1);
        setAppliedSearch(searchInput.trim());
    };

    const handleMovementTypeChange = (
        nextMovementType,
    ) => {
        setMovementType(nextMovementType);
        setPage(1);
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
        setMovementType("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    const handleOpenDetail = async (movement) => {
        try {
            setLoadingDetailId(movement.id);
            setDetailError("");

            const detail =
                await getInventoryMovementByIdRequest(
                    movement.id,
                );

            setSelectedInventoryMovement({
                ...movement,
                ...detail,
            });

            setIsDetailOpen(true);
        } catch (error) {
            setDetailError(
                error.response?.data?.message ||
                "Detail pergerakan inventory gagal dimuat.",
            );
        } finally {
            setLoadingDetailId("");
        }
    };

    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        setSelectedInventoryMovement(null);
    };

    const totalPages = Math.max(
        pagination.total_pages,
        1,
    );

    return (
        <div className="inventory-page">
            <section className="page-heading">
                <div>
                    <p>Purchasing &amp; Inventory</p>
                    <h2>Inventory</h2>
                    <span>
                        Pantau seluruh pergerakan stok masuk dan
                        keluar beserta sumber transaksinya.
                    </span>
                </div>

                <div className="page-heading-actions">
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

            <section className="data-panel">
                <form
                    ref={filtersRef}
                    className="data-filters inventory-filters"
                    onSubmit={handleSearch}
                >
                    <div className="search-control">
                        <Search aria-hidden="true" />

                        <input
                            type="search"
                            value={searchInput}
                            placeholder="Cari SKU, produk, referensi, atau catatan"
                            aria-label="Cari pergerakan inventory"
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                        />

                        <button type="submit">Cari</button>
                    </div>

                    <StatusFilter
                        value={movementType}
                        options={movementTypeOptions}
                        ariaLabel="Filter jenis pergerakan inventory"
                        onChange={handleMovementTypeChange}
                    />

                    {(
                        appliedSearch ||
                        movementType ||
                        dateFrom ||
                        dateTo
                    ) && (
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
                        <strong>
                            {inventoryMovements.length}
                        </strong>{" "}
                        dari{" "}
                        <strong>
                            {formatNumber(
                                pagination.total_data,
                            )}
                        </strong>{" "}
                        pergerakan stok
                    </p>
                </div>

                <div className="data-table-wrapper">
                    <table className="data-table inventory-table">
                        <thead>
                            <tr>
                                <th>Waktu</th>
                                <th>Produk</th>
                                <th>Jenis pergerakan</th>
                                <th>Kuantitas</th>
                                <th>Referensi</th>
                                <th>Dibuat oleh</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>

                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={7}
                                    >
                                        <RefreshCw
                                            className="is-spinning"
                                            aria-hidden="true"
                                        />
                                        Memuat pergerakan inventory...
                                    </td>
                                </tr>
                            ) : inventoryMovements.length === 0 ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={7}
                                    >
                                        <Warehouse aria-hidden="true" />
                                        Tidak ada pergerakan inventory
                                        yang sesuai.
                                    </td>
                                </tr>
                            ) : (
                                inventoryMovements.map(
                                    (movement) => {
                                        const presentation =
                                            movementPresentation[
                                            movement.movement_type
                                            ] ?? {
                                                label:
                                                    movement.movement_type,
                                                className: "",
                                            };

                                        const isOutbound =
                                            outboundMovementTypes.has(
                                                movement.movement_type,
                                            );

                                        return (
                                            <tr key={movement.id}>
                                                <td data-label="Waktu">
                                                    <span className="inventory-date">
                                                        {formatDateTime(
                                                            movement.movement_date,
                                                        )}
                                                    </span>
                                                </td>

                                                <td data-label="Produk">
                                                    <strong className="inventory-product">
                                                        {movement.product_name}
                                                    </strong>

                                                    <span className="inventory-subtext">
                                                        {movement.sku} ·{" "}
                                                        {movement.unit}
                                                    </span>
                                                </td>

                                                <td data-label="Jenis pergerakan">
                                                    <span
                                                        className={`inventory-movement-badge ${presentation.className}`}
                                                    >
                                                        {presentation.label}
                                                    </span>
                                                </td>

                                                <td data-label="Kuantitas">
                                                    <strong
                                                        className={`inventory-quantity ${isOutbound
                                                                ? "is-outbound"
                                                                : "is-inbound"
                                                            }`}
                                                    >
                                                        {isOutbound ? "-" : "+"}
                                                        {formatNumber(
                                                            movement.quantity,
                                                        )}{" "}
                                                        {movement.unit}
                                                    </strong>
                                                </td>

                                                <td data-label="Referensi">
                                                    <strong className="inventory-reference">
                                                        {movement.reference_type ||
                                                            "-"}
                                                    </strong>

                                                    <span
                                                        className="inventory-subtext"
                                                        title={
                                                            movement.reference_id ||
                                                            ""
                                                        }
                                                    >
                                                        {movement.reference_id
                                                            ? movement.reference_id
                                                                .slice(0, 8)
                                                                .toUpperCase()
                                                            : "-"}
                                                    </span>
                                                </td>

                                                <td data-label="Dibuat oleh">
                                                    <strong className="inventory-user">
                                                        {movement.created_by_name ||
                                                            "Sistem"}
                                                    </strong>
                                                </td>

                                                <td
                                                    className="table-action-cell"
                                                    data-label="Aksi"
                                                >
                                                    <button
                                                        type="button"
                                                        className="table-edit-action inventory-detail-action"
                                                        disabled={Boolean(
                                                            loadingDetailId,
                                                        )}
                                                        onClick={() =>
                                                            handleOpenDetail(
                                                                movement,
                                                            )
                                                        }
                                                    >
                                                        {loadingDetailId ===
                                                            movement.id ? (
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
                                    },
                                )
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
                                page >= totalPages ||
                                pagination.total_pages === 0
                            }
                            onClick={() =>
                                setPage((current) =>
                                    current + 1,
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
                <InventoryMovementDetailDialog
                    isOpen
                    movement={selectedInventoryMovement}
                    onClose={handleCloseDetail}
                />
            )}
        </div>
    );
};

export default InventoryPage;