import {
    AlertTriangle,
    ClipboardCheck,
    Eye,
    RefreshCw,
    Save,
    Search,
    Warehouse,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
    createStockInspectionRequest,
    getInventoryMovementByIdRequest,
    getInventoryMovementsRequest,
    getQuarantineStocksRequest,
} from "../api/inventoryMovements";
import StatusFilter from "../components/filters/StatusFilter";
import FormDatePicker from "../components/forms/FormDatePicker";
import FormSelect from "../components/forms/FormSelect";
import InventoryMovementDetailDialog from "../components/inventory/InventoryMovementDetailDialog";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useModalDismiss from "../hooks/useModalDismiss";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/inventory.css";
import { formatNumber } from "../utils/formatters";

const PAGE_LIMIT = 10;

const inspectionResultOptions = [
    {
        value: "AVAILABLE",
        code: "✓",
        label: "Layak dijual → Stok tersedia",
    },
    {
        value: "DAMAGED",
        code: "!",
        label: "Rusak → Stok rusak",
    },
];

const normalizeQuantityInput = (value) => {
    const numberValue = Number(value);

    return Number.isFinite(numberValue)
        ? String(numberValue)
        : "";
};

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

const referenceTypeLabels = {
    DELIVERY: "Delivery",
    GOODS_RECEIPT: "Penerimaan barang",
    STOCK_OPNAME: "Stok opname",
    PURCHASE_RETURN: "Retur pembelian",
    SALES_RETURN: "Retur penjualan",
};

const stockBucketLabels = {
    AVAILABLE: "Stok tersedia",
    QUARANTINE: "Stok karantina",
    DAMAGED: "Stok rusak",
};

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

const StockInspectionDialog = ({ products, busy, error, onClose, onSubmit }) => {
    useModalDismiss(true, onClose, busy);
    const [productId, setProductId] = useState(products[0]?.id || "");
    const [quantity, setQuantity] = useState(
        normalizeQuantityInput(products[0]?.quarantine_stock),
    );
    const [targetBucket, setTargetBucket] = useState("AVAILABLE");
    const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState("");
    const selectedProduct = products.find((product) => product.id === productId);
    const maximumQuantity = Number(selectedProduct?.quarantine_stock || 0);
    const productOptions = products.map((product) => ({
        value: product.id,
        code: product.sku,
        label: `${product.product_name} · karantina ${formatNumber(product.quarantine_stock)} ${product.unit}`,
        searchText: `${product.sku} ${product.product_name}`,
    }));

    const selectProduct = (value) => {
        const product = products.find((item) => item.id === value);
        setProductId(value);
        setQuantity(
            product
                ? normalizeQuantityInput(product.quarantine_stock)
                : "",
        );
    };

    const submit = (event) => {
        event.preventDefault();
        onSubmit({ product_id: productId, quantity: Number(quantity), target_bucket: targetBucket, inspection_date: inspectionDate, notes });
    };

    return (
        <div className="inventory-inspection-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
            <section className="inventory-inspection-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-inspection-title">
                <header><div><span>INVENTORY</span><h2 id="inventory-inspection-title">Periksa stok karantina</h2><p>Pindahkan barang hasil pemeriksaan ke stok tersedia atau stok rusak.</p></div><button type="button" aria-label="Tutup" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button></header>
                <form onSubmit={submit}>
                    <div className="inventory-inspection-body">
                        <div className="inventory-inspection-field is-full"><FormSelect label="Produk" value={productId} options={productOptions} placeholder={products.length ? "Pilih produk" : "Tidak ada stok karantina"} searchPlaceholder="Cari SKU atau produk" disabled={busy || products.length === 0} onChange={selectProduct} /></div>
                        <label className="inventory-inspection-field"><span>Kuantitas diperiksa</span><input type="number" min="0.001" max={maximumQuantity} step="0.001" value={quantity} disabled={busy || !productId} onChange={(event) => setQuantity(event.target.value)} /><small>Maksimal {formatNumber(maximumQuantity)} {selectedProduct?.unit || "unit"}.</small></label>
                        <FormSelect label="Hasil pemeriksaan" value={targetBucket} options={inspectionResultOptions} searchable={false} disabled={busy} onChange={setTargetBucket} />
                        <FormDatePicker label="Tanggal pemeriksaan" value={inspectionDate} disabled={busy} onChange={setInspectionDate} />
                        <label className="inventory-inspection-field"><span>Catatan pemeriksaan</span><textarea rows={3} maxLength={1000} value={notes} placeholder="Contoh: kemasan baik dan produk layak dijual" disabled={busy} onChange={(event) => setNotes(event.target.value)} /></label>
                        {products.length === 0 && <div className="inventory-inspection-info is-full">Tidak ada barang yang sedang berada di stok karantina.</div>}
                        {error && <div className="data-error is-full" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Pemeriksaan tidak dapat disimpan</strong><span>{error}</span></div></div>}
                    </div>
                    <footer><button type="button" className="secondary-action" disabled={busy} onClick={onClose}>Batal</button><button type="submit" className="primary-action" disabled={busy || !productId || Number(quantity) <= 0 || Number(quantity) > maximumQuantity}><Save aria-hidden="true" /><span>{busy ? "Menyimpan..." : "Simpan pemeriksaan"}</span></button></footer>
                </form>
            </section>
        </div>
    );
};

const InventoryPage = () => {
    const { user } = useAuth();
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
    const [isInspectionOpen, setIsInspectionOpen] = useState(false);
    const [quarantineProducts, setQuarantineProducts] = useState([]);
    const [isInspectionBusy, setIsInspectionBusy] = useState(false);
    const [inspectionError, setInspectionError] = useState("");

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

    const handleOpenInspection = async () => {
        try {
            setIsInspectionBusy(true);
            setInspectionError("");
            setQuarantineProducts(await getQuarantineStocksRequest());
            setIsInspectionOpen(true);
        } catch (error) {
            setInspectionError(error.response?.data?.message || "Stok karantina gagal dimuat.");
        } finally {
            setIsInspectionBusy(false);
        }
    };

    const handleSaveInspection = async (payload) => {
        try {
            setIsInspectionBusy(true);
            setInspectionError("");
            await createStockInspectionRequest(payload);
            setIsInspectionOpen(false);
            setQuarantineProducts([]);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setInspectionError(error.response?.data?.message || "Pemeriksaan stok gagal disimpan.");
        } finally {
            setIsInspectionBusy(false);
        }
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
                    {["ADMIN", "WAREHOUSE", "MANAGER"].includes(user?.role) && (
                        <button type="button" className="primary-action" disabled={isInspectionBusy} onClick={handleOpenInspection}>
                            <ClipboardCheck aria-hidden="true" />
                            <span>Periksa stok</span>
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

                {inspectionError && !isInspectionOpen && (
                    <div className="data-error" role="alert">
                        <AlertTriangle aria-hidden="true" />
                        <div><strong>Pemeriksaan stok tidak dapat dibuka</strong><span>{inspectionError}</span></div>
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
                                                    {movement.stock_bucket && (
                                                        <span className="inventory-subtext inventory-stock-bucket">
                                                            {stockBucketLabels[movement.stock_bucket] || "Tujuan stok lainnya"}
                                                        </span>
                                                    )}
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
                                                        {referenceTypeLabels[
                                                            movement.reference_type
                                                        ] ||
                                                            movement.reference_type ||
                                                            "-"}
                                                    </strong>

                                                    <span
                                                        className="inventory-subtext"
                                                        title={
                                                            movement.reference_number ||
                                                            ""
                                                        }
                                                    >
                                                        {movement.reference_number ||
                                                            "-"}
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

                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    isLoading={isLoading}
                    onPageChange={setPage}
                />
            </section>
            {isDetailOpen && (
                <InventoryMovementDetailDialog
                    isOpen
                    movement={selectedInventoryMovement}
                    onClose={handleCloseDetail}
                />
            )}
            {isInspectionOpen && (
                <StockInspectionDialog
                    products={quarantineProducts}
                    busy={isInspectionBusy}
                    error={inspectionError}
                    onClose={() => { if (!isInspectionBusy) { setIsInspectionOpen(false); setInspectionError(""); } }}
                    onSubmit={handleSaveInspection}
                />
            )}
        </div>
    );
};

export default InventoryPage;
