import {
    AlertTriangle,
    Building2,
    Mail,
    Pencil,
    Phone,
    Plus,
    Power,
    PowerOff,
    RefreshCw,
    Search,
    X,
} from "lucide-react";
import {
    useEffect,
    useState,
} from "react";
import {
    createSupplierRequest,
    getSupplierByIdRequest,
    getSuppliersRequest,
    updateSupplierRequest,
    updateSupplierStatusRequest,
} from "../api/suppliers";
import SupplierFormModal from "../components/suppliers/SupplierFormModal";
import StatusFilter from "../components/filters/StatusFilter";
import StatusConfirmDialog from "../components/dialogs/StatusConfirmDialog";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import { formatNumber } from "../utils/formatters";
import "../styles/suppliers.css";

const PAGE_LIMIT = 10;

const SuppliersPage = () => {
    const { user } = useAuth();

    const canManageSuppliers = [
        "ADMIN",
        "PURCHASING",
    ].includes(user?.role);
    const [suppliers, setSuppliers] = useState([]);
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
    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);

    const [isLoading, setIsLoading] =
        useState(true);
    const [errorMessage, setErrorMessage] =
        useState("");
    const [isSupplierFormOpen, setIsSupplierFormOpen] =
        useState(false);
    const [selectedSupplier, setSelectedSupplier] =
        useState(null);
    const [isPreparingForm, setIsPreparingForm] =
        useState(false);
    const [isSubmitting, setIsSubmitting] =
        useState(false);
    const [formError, setFormError] = useState("");
    const [actionError, setActionError] =
        useState("");
    const [statusSupplier, setStatusSupplier] =
        useState(null);
    const [isStatusDialogOpen, setIsStatusDialogOpen] =
        useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] =
        useState(false);
    const [statusError, setStatusError] =
        useState("");

    useEffect(() => {
        let isCancelled = false;

        const fetchSuppliers = async () => {
            try {
                setIsLoading(true);
                setErrorMessage("");

                const response = await getSuppliersRequest({
                    page,
                    limit: PAGE_LIMIT,
                    ...(appliedSearch && {
                        search: appliedSearch,
                    }),
                    ...(status && { status }),
                });

                if (!isCancelled) {
                    setSuppliers(response.data);
                    setPagination(response.pagination);
                }
            } catch (error) {
                if (!isCancelled) {
                    setSuppliers([]);
                    setErrorMessage(
                        error.response?.data?.message ||
                        "Supplier gagal dimuat. Silakan coba kembali.",
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchSuppliers();

        return () => {
            isCancelled = true;
        };
    }, [
        page,
        appliedSearch,
        status,
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

    const handleResetFilters = () => {
        setSearchInput("");
        setAppliedSearch("");
        setStatus("");
        setPage(1);
    };

    const handleOpenCreateForm = () => {
        if (!canManageSuppliers) {
            return;
        }

        setSelectedSupplier(null);
        setFormError("");
        setActionError("");
        setIsSupplierFormOpen(true);
    };

    const handleOpenEditForm = async (supplier) => {
        if (!canManageSuppliers) {
            return;
        }

        try {
            setIsPreparingForm(true);
            setActionError("");
            setFormError("");

            const supplierDetail =
                await getSupplierByIdRequest(supplier.id);

            setSelectedSupplier(supplierDetail);
            setIsSupplierFormOpen(true);
        } catch (error) {
            setActionError(
                error.response?.data?.message ||
                "Detail supplier gagal dimuat.",
            );
        } finally {
            setIsPreparingForm(false);
        }
    };

    const handleCloseSupplierForm = () => {
        if (isSubmitting) {
            return;
        }

        setIsSupplierFormOpen(false);
        setSelectedSupplier(null);
        setFormError("");
    };

    const handleSaveSupplier = async (payload) => {
        try {
            setIsSubmitting(true);
            setFormError("");

            if (selectedSupplier) {
                await updateSupplierRequest(
                    selectedSupplier.id,
                    payload,
                );
            } else {
                await createSupplierRequest(payload);
                setPage(1);
            }

            setIsSupplierFormOpen(false);
            setSelectedSupplier(null);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setFormError(
                error.response?.data?.message ||
                `Supplier gagal ${selectedSupplier
                    ? "diperbarui"
                    : "ditambahkan"
                }.`,
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenStatusDialog = (supplier) => {
        if (!canManageSuppliers) {
            return;
        }

        setStatusSupplier(supplier);
        setStatusError("");
        setIsStatusDialogOpen(true);
    };

    const handleCloseStatusDialog = () => {
        if (isUpdatingStatus) {
            return;
        }

        setIsStatusDialogOpen(false);
        setStatusSupplier(null);
        setStatusError("");
    };

    const handleConfirmSupplierStatus = async (
        nextStatus,
    ) => {
        if (!statusSupplier) {
            return;
        }

        try {
            setIsUpdatingStatus(true);
            setStatusError("");

            await updateSupplierStatusRequest(
                statusSupplier.id,
                nextStatus,
            );

            setIsStatusDialogOpen(false);
            setStatusSupplier(null);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setStatusError(
                error.response?.data?.message ||
                "Status supplier gagal diperbarui.",
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
        Boolean(appliedSearch) || Boolean(status);

    return (
        <div className="products-page suppliers-page">
            <section className="page-heading">
                <div>
                    <p>Master Data</p>
                    <h2>Suppliers</h2>
                    <span>
                        Kelola data pemasok, kontak, lokasi, dan
                        ketentuan pembayaran.
                    </span>
                </div>

                <div className="page-heading-actions">
                    {canManageSuppliers && (
                        <button
                            type="button"
                            className="primary-action"
                            disabled={isPreparingForm}
                            onClick={handleOpenCreateForm}
                        >
                            <Plus aria-hidden="true" />
                            <span>Tambah supplier</span>
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
                {actionError && (
                    <div
                        className="product-action-error"
                        role="alert"
                    >
                        <AlertTriangle aria-hidden="true" />
                        <span>{actionError}</span>
                    </div>
                )}
            </section>

            <section className="data-panel">
                <form
                    className="data-filters supplier-filters"
                    onSubmit={handleSearch}
                >
                    <div className="search-control">
                        <Search aria-hidden="true" />

                        <input
                            type="search"
                            value={searchInput}
                            placeholder="Cari kode, nama, kontak, telepon, email, atau kota"
                            aria-label="Cari supplier"
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                        />

                        <button type="submit">Cari</button>
                    </div>

                    <StatusFilter
                        value={status}
                        onChange={handleStatusChange}
                        ariaLabel="Filter status supplier"
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
                            <strong>
                                Data tidak dapat ditampilkan
                            </strong>
                            <span>{errorMessage}</span>
                        </div>
                    </div>
                )}

                <div className="table-summary">
                    <p>
                        Menampilkan{" "}
                        <strong>{suppliers.length}</strong> dari{" "}
                        <strong>
                            {formatNumber(pagination.total)}
                        </strong>{" "}
                        supplier
                    </p>
                </div>

                <div className="data-table-wrapper">
                    <table
                        className={`data-table supplier-table ${canManageSuppliers ? "has-actions" : ""
                            }`}
                    >
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Supplier</th>
                                <th>Kontak</th>
                                <th>Kota</th>
                                <th>Termin</th>
                                <th>Status</th>
                                {canManageSuppliers && <th>Aksi</th>}
                            </tr>
                        </thead>

                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={canManageSuppliers ? 7 : 6}
                                    >
                                        <RefreshCw
                                            className="is-spinning"
                                            aria-hidden="true"
                                        />
                                        Memuat data supplier...
                                    </td>
                                </tr>
                            ) : suppliers.length === 0 ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={canManageSuppliers ? 7 : 6}
                                    >
                                        <Building2 aria-hidden="true" />
                                        Tidak ada supplier yang sesuai.
                                    </td>
                                </tr>
                            ) : (
                                suppliers.map((supplier) => (
                                    <tr key={supplier.id}>
                                        <td data-label="Kode">
                                            <strong className="sku-text">
                                                {supplier.supplier_code}
                                            </strong>
                                        </td>

                                        <td data-label="Supplier">
                                            <div className="supplier-name-cell">
                                                <strong>
                                                    {supplier.supplier_name}
                                                </strong>
                                                <span>
                                                    {supplier.contact_person ||
                                                        "Belum ada kontak"}
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="Kontak">
                                            <div className="supplier-contact-cell">
                                                {supplier.phone ? (
                                                    <a
                                                        href={`tel:${supplier.phone}`}
                                                    >
                                                        <Phone aria-hidden="true" />
                                                        {supplier.phone}
                                                    </a>
                                                ) : (
                                                    <span>-</span>
                                                )}

                                                {supplier.email && (
                                                    <a
                                                        href={`mailto:${supplier.email}`}
                                                    >
                                                        <Mail aria-hidden="true" />
                                                        {supplier.email}
                                                    </a>
                                                )}
                                            </div>
                                        </td>

                                        <td data-label="Kota">
                                            {supplier.city || "-"}
                                        </td>

                                        <td data-label="Termin">
                                            {formatNumber(
                                                supplier.payment_terms_days,
                                            )}{" "}
                                            hari
                                        </td>

                                        <td data-label="Status">
                                            <span
                                                className={`status-badge ${supplier.status === "ACTIVE"
                                                    ? "is-active"
                                                    : "is-inactive"
                                                    }`}
                                            >
                                                {supplier.status}
                                            </span>
                                        </td>
                                        {canManageSuppliers && (
                                            <td
                                                className="table-action-cell"
                                                data-label="Aksi"
                                            >
                                                <div className="table-action-buttons">
                                                    <button
                                                        type="button"
                                                        className="table-edit-action"
                                                        disabled={
                                                            isPreparingForm || isUpdatingStatus
                                                        }
                                                        onClick={() =>
                                                            handleOpenEditForm(supplier)
                                                        }
                                                    >
                                                        <Pencil aria-hidden="true" />
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={`table-status-action ${supplier.status === "ACTIVE"
                                                            ? "is-deactivate"
                                                            : "is-activate"
                                                            }`}
                                                        disabled={
                                                            isPreparingForm || isUpdatingStatus
                                                        }
                                                        onClick={() =>
                                                            handleOpenStatusDialog(supplier)
                                                        }
                                                    >
                                                        {supplier.status === "ACTIVE" ? (
                                                            <PowerOff aria-hidden="true" />
                                                        ) : (
                                                            <Power aria-hidden="true" />
                                                        )}

                                                        {supplier.status === "ACTIVE"
                                                            ? "Nonaktifkan"
                                                            : "Aktifkan"}
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
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
            {isSupplierFormOpen && (
                <SupplierFormModal
                    key={selectedSupplier?.id ?? "create"}
                    isOpen
                    mode={selectedSupplier ? "edit" : "create"}
                    supplier={selectedSupplier}
                    isSubmitting={isSubmitting}
                    requestError={formError}
                    onClose={handleCloseSupplierForm}
                    onSubmit={handleSaveSupplier}
                />
            )}
            {isStatusDialogOpen && (
                <StatusConfirmDialog
                    isOpen
                    entityLabel="supplier"
                    entityName={
                        statusSupplier?.supplier_name ?? ""
                    }
                    identifierLabel="kode"
                    identifierValue={
                        statusSupplier?.supplier_code ?? ""
                    }
                    currentStatus={
                        statusSupplier?.status ?? ""
                    }
                    isSubmitting={isUpdatingStatus}
                    requestError={statusError}
                    onCancel={handleCloseStatusDialog}
                    onConfirm={handleConfirmSupplierStatus}
                />
            )}
        </div>
    );
};

export default SuppliersPage;