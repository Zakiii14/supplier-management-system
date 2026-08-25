import {
    AlertTriangle,
    UsersRound,
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
    createCustomerRequest,
    getCustomerByIdRequest,
    getCustomersRequest,
    updateCustomerRequest,
    updateCustomerStatusRequest,
} from "../api/customers";
import CustomerFormModal from "../components/customers/CustomerFormModal";
import StatusFilter from "../components/filters/StatusFilter";
import StatusConfirmDialog from "../components/dialogs/StatusConfirmDialog";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import { formatNumber } from "../utils/formatters";
import "../styles/customers.css";

const PAGE_LIMIT = 10;

const CustomersPage = () => {
    const { user } = useAuth();

    const canManageCustomers = [
        "ADMIN",
        "SALES",
    ].includes(user?.role);
    const [customers, setCustomers] = useState([]);
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
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);

    const [isLoading, setIsLoading] =
        useState(true);
    const [errorMessage, setErrorMessage] =
        useState("");
    const [isCustomerFormOpen, setIsCustomerFormOpen] =
        useState(false);
    const [selectedCustomer, setSelectedCustomer] =
        useState(null);
    const [isPreparingForm, setIsPreparingForm] =
        useState(false);
    const [isSubmitting, setIsSubmitting] =
        useState(false);
    const [formError, setFormError] = useState("");
    const [actionError, setActionError] =
        useState("");
    const [statusCustomer, setStatusCustomer] =
        useState(null);
    const [isStatusDialogOpen, setIsStatusDialogOpen] =
        useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] =
        useState(false);
    const [statusError, setStatusError] =
        useState("");

    useEffect(() => {
        let isCancelled = false;

        const fetchCustomers = async () => {
            try {
                setIsLoading(true);
                setErrorMessage("");

                const response = await getCustomersRequest({
                    page,
                    limit: PAGE_LIMIT,
                    ...(appliedSearch && {
                        search: appliedSearch,
                    }),
                    ...(status && { status }),
                });

                if (!isCancelled) {
                    setCustomers(response.data);
                    setPagination(response.pagination);
                }
            } catch (error) {
                if (!isCancelled) {
                    setCustomers([]);
                    setErrorMessage(
                        error.response?.data?.message ||
                        "Customer gagal dimuat. Silakan coba kembali.",
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchCustomers();

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
        if (!canManageCustomers) {
            return;
        }

        setSelectedCustomer(null);
        setFormError("");
        setActionError("");
        setIsCustomerFormOpen(true);
    };

    const handleOpenEditForm = async (customer) => {
        if (!canManageCustomers) {
            return;
        }

        try {
            setIsPreparingForm(true);
            setActionError("");
            setFormError("");

            const customerDetail =
                await getCustomerByIdRequest(customer.id);

            setSelectedCustomer(customerDetail);
            setIsCustomerFormOpen(true);
        } catch (error) {
            setActionError(
                error.response?.data?.message ||
                "Detail customer gagal dimuat.",
            );
        } finally {
            setIsPreparingForm(false);
        }
    };

    const handleCloseCustomerForm = () => {
        if (isSubmitting) {
            return;
        }

        setIsCustomerFormOpen(false);
        setSelectedCustomer(null);
        setFormError("");
    };

    const handleSaveCustomer = async (payload) => {
        try {
            setIsSubmitting(true);
            setFormError("");

            if (selectedCustomer) {
                await updateCustomerRequest(
                    selectedCustomer.id,
                    payload,
                );
            } else {
                await createCustomerRequest(payload);
                setPage(1);
            }

            setIsCustomerFormOpen(false);
            setSelectedCustomer(null);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setFormError(
                error.response?.data?.message ||
                `Customer gagal ${selectedCustomer
                    ? "diperbarui"
                    : "ditambahkan"
                }.`,
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenStatusDialog = (customer) => {
        if (!canManageCustomers) {
            return;
        }

        setStatusCustomer(customer);
        setStatusError("");
        setIsStatusDialogOpen(true);
    };

    const handleCloseStatusDialog = () => {
        if (isUpdatingStatus) {
            return;
        }

        setIsStatusDialogOpen(false);
        setStatusCustomer(null);
        setStatusError("");
    };

    const handleConfirmCustomerStatus = async (
        nextStatus,
    ) => {
        if (!statusCustomer) {
            return;
        }

        try {
            setIsUpdatingStatus(true);
            setStatusError("");

            await updateCustomerStatusRequest(
                statusCustomer.id,
                nextStatus,
            );

            setIsStatusDialogOpen(false);
            setStatusCustomer(null);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setStatusError(
                error.response?.data?.message ||
                "Status customer gagal diperbarui.",
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
        <div className="products-page customers-page">
            <section className="page-heading">
                <div>
                    <p>Master Data</p>
                    <h2>Customers</h2>
                    <span>
                        Kelola data pelanggan, kontak, lokasi, dan
                        ketentuan pembayaran.
                    </span>
                </div>

                <div className="page-heading-actions">
                    {canManageCustomers && (
                        <button
                            type="button"
                            className="primary-action"
                            disabled={isPreparingForm}
                            onClick={handleOpenCreateForm}
                        >
                            <Plus aria-hidden="true" />
                            <span>Tambah customer</span>
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
                    className="data-filters customer-filters"
                    onSubmit={handleSearch}
                >
                    <div className="search-control">
                        <Search aria-hidden="true" />

                        <input
                            type="search"
                            value={searchInput}
                            placeholder="Cari kode, nama, kontak, telepon, atau email"
                            aria-label="Cari customer"
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                        />

                        <button type="submit">Cari</button>
                    </div>

                    <StatusFilter
                        value={status}
                        onChange={handleStatusChange}
                        ariaLabel="Filter status customer"
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
                        <strong>{customers.length}</strong> dari{" "}
                        <strong>
                            {formatNumber(pagination.total_data)}
                        </strong>{" "}
                        customer
                    </p>
                </div>

                <div className="data-table-wrapper">
                    <table
                        className={`data-table customer-table ${canManageCustomers ? "has-actions" : ""
                            }`}
                    >
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Customer</th>
                                <th>Kontak</th>
                                <th>Kota</th>
                                <th>Termin</th>
                                <th>Batas kredit</th>
                                <th>Status</th>
                                <th>Status</th>
                                {canManageCustomers && <th>Aksi</th>}
                            </tr>
                        </thead>

                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={canManageCustomers ? 8 : 7}
                                    >
                                        <RefreshCw
                                            className="is-spinning"
                                            aria-hidden="true"
                                        />
                                        Memuat data customer...
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={canManageCustomers ? 8 : 7}
                                    >
                                        <UsersRound aria-hidden="true" />
                                        Tidak ada customer yang sesuai.
                                    </td>
                                </tr>
                            ) : (
                                customers.map((customer) => (
                                    <tr key={customer.id}>
                                        <td data-label="Kode">
                                            <strong className="sku-text">
                                                {customer.customer_code}
                                            </strong>
                                        </td>

                                        <td data-label="Customer">
                                            <div className="customer-name-cell">
                                                <strong>
                                                    {customer.customer_name}
                                                </strong>
                                                <span>
                                                    {customer.contact_person ||
                                                        "Belum ada kontak"}
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="Kontak">
                                            <div className="customer-contact-cell">
                                                {customer.phone ? (
                                                    <a
                                                        href={`tel:${customer.phone}`}
                                                    >
                                                        <Phone aria-hidden="true" />
                                                        {customer.phone}
                                                    </a>
                                                ) : (
                                                    <span>-</span>
                                                )}

                                                {customer.email && (
                                                    <a
                                                        href={`mailto:${customer.email}`}
                                                    >
                                                        <Mail aria-hidden="true" />
                                                        {customer.email}
                                                    </a>
                                                )}
                                            </div>
                                        </td>

                                        <td data-label="Kota">
                                            {customer.city || "-"}
                                        </td>

                                        <td data-label="Termin">
                                            {formatNumber(
                                                customer.payment_terms_days,
                                            )}{" "}
                                            hari
                                        </td>

                                        <td data-label="Batas kredit">
                                            Rp{" "}
                                            {formatNumber(
                                                customer.credit_limit,
                                            )}
                                        </td>

                                        <td data-label="Status">
                                            <span
                                                className={`status-badge ${customer.status === "ACTIVE"
                                                    ? "is-active"
                                                    : "is-inactive"
                                                    }`}
                                            >
                                                {customer.status}
                                            </span>
                                        </td>
                                        {canManageCustomers && (
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
                                                            handleOpenEditForm(customer)
                                                        }
                                                    >
                                                        <Pencil aria-hidden="true" />
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={`table-status-action ${customer.status === "ACTIVE"
                                                            ? "is-deactivate"
                                                            : "is-activate"
                                                            }`}
                                                        disabled={
                                                            isPreparingForm || isUpdatingStatus
                                                        }
                                                        onClick={() =>
                                                            handleOpenStatusDialog(customer)
                                                        }
                                                    >
                                                        {customer.status === "ACTIVE" ? (
                                                            <PowerOff aria-hidden="true" />
                                                        ) : (
                                                            <Power aria-hidden="true" />
                                                        )}

                                                        {customer.status === "ACTIVE"
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
            {isCustomerFormOpen && (
                <CustomerFormModal
                    key={selectedCustomer?.id ?? "create"}
                    isOpen
                    mode={selectedCustomer ? "edit" : "create"}
                    customer={selectedCustomer}
                    isSubmitting={isSubmitting}
                    requestError={formError}
                    onClose={handleCloseCustomerForm}
                    onSubmit={handleSaveCustomer}
                />
            )}
            {isStatusDialogOpen && (
                <StatusConfirmDialog
                    isOpen
                    entityLabel="customer"
                    entityName={
                        statusCustomer?.customer_name ?? ""
                    }
                    identifierLabel="kode"
                    identifierValue={
                        statusCustomer?.customer_code ?? ""
                    }
                    currentStatus={
                        statusCustomer?.status ?? ""
                    }
                    isSubmitting={isUpdatingStatus}
                    requestError={statusError}
                    onCancel={handleCloseStatusDialog}
                    onConfirm={handleConfirmCustomerStatus}
                />
            )}
        </div>
    );
};

export default CustomersPage;