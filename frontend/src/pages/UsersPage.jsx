import {
    AlertTriangle,
    Eye,
    KeyRound,
    Pencil,
    Plus,
    Power,
    PowerOff,
    RefreshCw,
    Search,
    UserCog,
    X,
} from "lucide-react";
import {
    useEffect,
    useState,
} from "react";
import {
    createUserRequest,
    getUserByIdRequest,
    getUsersRequest,
    resetUserPasswordRequest,
    updateUserRequest,
    updateUserStatusRequest,
} from "../api/users";
import StatusConfirmDialog from "../components/dialogs/StatusConfirmDialog";
import StatusFilter from "../components/filters/StatusFilter";
import PaginationBar from "../components/tables/PaginationBar";
import UserDetailDialog from "../components/users/UserDetailDialog";
import UserFormModal from "../components/users/UserFormModal";
import UserPasswordDialog from "../components/users/UserPasswordDialog";
import useAuth from "../hooks/useAuth";
import "../styles/products.css";
import "../styles/suppliers.css";
import "../styles/users.css";
import {
    formatDate,
    formatNumber,
} from "../utils/formatters";

const PAGE_LIMIT = 10;

const roleOptions = [
    {
        value: "",
        label: "Semua role",
    },
    {
        value: "ADMIN",
        label: "Administrator",
    },
    {
        value: "PURCHASING",
        label: "Purchasing",
    },
    {
        value: "WAREHOUSE",
        label: "Warehouse",
    },
    {
        value: "SALES",
        label: "Sales",
    },
    {
        value: "FINANCE",
        label: "Finance",
    },
    {
        value: "MANAGER",
        label: "Manager",
    },
];

const statusOptions = [
    {
        value: "",
        label: "Semua status",
    },
    {
        value: "ACTIVE",
        label: "Aktif",
    },
    {
        value: "INACTIVE",
        label: "Tidak aktif",
    },
];

const rolePresentation = {
    ADMIN: {
        label: "Administrator",
        className: "is-admin",
    },
    PURCHASING: {
        label: "Purchasing",
        className: "is-purchasing",
    },
    WAREHOUSE: {
        label: "Warehouse",
        className: "is-warehouse",
    },
    SALES: {
        label: "Sales",
        className: "is-sales",
    },
    FINANCE: {
        label: "Finance",
        className: "is-finance",
    },
    MANAGER: {
        label: "Manager",
        className: "is-manager",
    },
};

const UsersPage = () => {
    const { user: currentUser } = useAuth();

    const [users, setUsers] = useState([]);

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
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] =
        useState(0);
    const [isLoading, setIsLoading] =
        useState(true);
    const [errorMessage, setErrorMessage] =
        useState("");
    const [actionError, setActionError] =
        useState("");

    const [selectedUser, setSelectedUser] =
        useState(null);
    const [isUserFormOpen, setIsUserFormOpen] =
        useState(false);
    const [isPreparingForm, setIsPreparingForm] =
        useState(false);
    const [isSubmitting, setIsSubmitting] =
        useState(false);
    const [formError, setFormError] =
        useState("");

    const [detailUser, setDetailUser] =
        useState(null);
    const [isDetailOpen, setIsDetailOpen] =
        useState(false);
    const [loadingDetailId, setLoadingDetailId] =
        useState("");
    const [detailError, setDetailError] =
        useState("");

    const [statusUser, setStatusUser] =
        useState(null);
    const [isStatusDialogOpen, setIsStatusDialogOpen] =
        useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] =
        useState(false);
    const [statusError, setStatusError] =
        useState("");

    const [passwordUser, setPasswordUser] =
        useState(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] =
        useState(false);
    const [isResettingPassword, setIsResettingPassword] =
        useState(false);
    const [passwordError, setPasswordError] =
        useState("");

    useEffect(() => {
        let isCancelled = false;

        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                setErrorMessage("");

                const response = await getUsersRequest({
                    page,
                    limit: PAGE_LIMIT,
                    ...(appliedSearch && {
                        search: appliedSearch,
                    }),
                    ...(role && { role }),
                    ...(status && { status }),
                });

                if (!isCancelled) {
                    setUsers(response.data);
                    setPagination(response.pagination);
                }
            } catch (error) {
                if (!isCancelled) {
                    setUsers([]);
                    setPagination({
                        page,
                        limit: PAGE_LIMIT,
                        total: 0,
                        total_pages: 0,
                    });

                    setErrorMessage(
                        error.response?.data?.message ||
                        "Data pengguna gagal dimuat. Silakan coba kembali.",
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchUsers();

        return () => {
            isCancelled = true;
        };
    }, [
        page,
        appliedSearch,
        role,
        status,
        reloadKey,
    ]);

    const handleSearch = (event) => {
        event.preventDefault();
        setPage(1);
        setAppliedSearch(searchInput.trim());
    };

    const handleRoleChange = (nextRole) => {
        setPage(1);
        setRole(nextRole);
    };

    const handleStatusChange = (nextStatus) => {
        setPage(1);
        setStatus(nextStatus);
    };

    const handleResetFilters = () => {
        setSearchInput("");
        setAppliedSearch("");
        setRole("");
        setStatus("");
        setPage(1);
    };

    const handleOpenCreateForm = () => {
        setSelectedUser(null);
        setFormError("");
        setActionError("");
        setIsUserFormOpen(true);
    };

    const handleOpenEditForm = async (user) => {
        try {
            setIsPreparingForm(true);
            setActionError("");
            setFormError("");

            const userDetail =
                await getUserByIdRequest(user.id);

            setSelectedUser(userDetail);
            setIsUserFormOpen(true);
        } catch (error) {
            setActionError(
                error.response?.data?.message ||
                "Detail pengguna gagal dimuat untuk diedit.",
            );
        } finally {
            setIsPreparingForm(false);
        }
    };

    const handleCloseUserForm = () => {
        if (isSubmitting) {
            return;
        }

        setIsUserFormOpen(false);
        setSelectedUser(null);
        setFormError("");
    };

    const handleSaveUser = async (payload) => {
        try {
            setIsSubmitting(true);
            setFormError("");

            if (selectedUser) {
                await updateUserRequest(
                    selectedUser.id,
                    payload,
                );
            } else {
                await createUserRequest(payload);
                setPage(1);
            }

            setIsUserFormOpen(false);
            setSelectedUser(null);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setFormError(
                error.response?.data?.message ||
                `Pengguna gagal ${selectedUser
                    ? "diperbarui"
                    : "ditambahkan"
                }.`,
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenDetail = async (userId) => {
        try {
            setLoadingDetailId(userId);
            setDetailError("");

            const userDetail =
                await getUserByIdRequest(userId);

            setDetailUser(userDetail);
            setIsDetailOpen(true);
        } catch (error) {
            setDetailError(
                error.response?.data?.message ||
                "Detail pengguna gagal dimuat.",
            );
        } finally {
            setLoadingDetailId("");
        }
    };

    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        setDetailUser(null);
    };

    const handleOpenStatusDialog = (user) => {
        if (user.id === currentUser?.id) {
            setActionError(
                "Akun yang sedang digunakan tidak dapat dinonaktifkan.",
            );
            return;
        }

        setStatusUser(user);
        setStatusError("");
        setActionError("");
        setIsStatusDialogOpen(true);
    };

    const handleCloseStatusDialog = () => {
        if (isUpdatingStatus) {
            return;
        }

        setIsStatusDialogOpen(false);
        setStatusUser(null);
        setStatusError("");
    };

    const handleConfirmUserStatus = async (
        nextStatus,
    ) => {
        if (!statusUser) {
            return;
        }

        try {
            setIsUpdatingStatus(true);
            setStatusError("");

            await updateUserStatusRequest(
                statusUser.id,
                nextStatus,
            );

            setIsStatusDialogOpen(false);
            setStatusUser(null);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setStatusError(
                error.response?.data?.message ||
                "Status pengguna gagal diperbarui.",
            );
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleOpenPasswordDialog = (user) => {
        setPasswordUser(user);
        setPasswordError("");
        setActionError("");
        setIsPasswordDialogOpen(true);
    };

    const handleClosePasswordDialog = () => {
        if (isResettingPassword) {
            return;
        }

        setIsPasswordDialogOpen(false);
        setPasswordUser(null);
        setPasswordError("");
    };

    const handleResetPassword = async (password) => {
        if (!passwordUser) {
            return;
        }

        try {
            setIsResettingPassword(true);
            setPasswordError("");

            await resetUserPasswordRequest(
                passwordUser.id,
                password,
            );

            setIsPasswordDialogOpen(false);
            setPasswordUser(null);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setPasswordError(
                error.response?.data?.message ||
                "Password pengguna gagal direset.",
            );
        } finally {
            setIsResettingPassword(false);
        }
    };

    const totalPages = Math.max(
        pagination.total_pages,
        1,
    );

    const hasActiveFilters =
        Boolean(appliedSearch) ||
        Boolean(role) ||
        Boolean(status);

    const isActionBusy =
        isPreparingForm ||
        Boolean(loadingDetailId) ||
        isUpdatingStatus ||
        isResettingPassword;

    return (
        <div className="products-page users-page">
            <section className="page-heading">
                <div>
                    <p>Administration</p>

                    <h2>User Management</h2>

                    <span>
                        Kelola akun, role, status, dan akses
                        pengguna ke dalam sistem.
                    </span>
                </div>

                <div className="page-heading-actions">
                    <button
                        type="button"
                        className="primary-action"
                        disabled={isPreparingForm}
                        onClick={handleOpenCreateForm}
                    >
                        <Plus aria-hidden="true" />

                        <span>Tambah Pengguna</span>
                    </button>

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
                    className="data-filters product-filters user-filters"
                    onSubmit={handleSearch}
                >
                    <div className="search-control">
                        <Search aria-hidden="true" />

                        <input
                            type="search"
                            value={searchInput}
                            placeholder="Cari username, nama, atau email"
                            aria-label="Cari pengguna"
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                        />

                        <button type="submit">Cari</button>
                    </div>

                    <StatusFilter
                        value={role}
                        options={roleOptions}
                        onChange={handleRoleChange}
                        ariaLabel="Filter role pengguna"
                    />

                    <StatusFilter
                        value={status}
                        options={statusOptions}
                        onChange={handleStatusChange}
                        ariaLabel="Filter status pengguna"
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
                        <strong>{users.length}</strong> dari{" "}
                        <strong>
                            {formatNumber(pagination.total)}
                        </strong>{" "}
                        pengguna
                    </p>
                </div>

                <div className="data-table-wrapper">
                    <table className="data-table user-table">
                        <thead>
                            <tr>
                                <th>Pengguna</th>
                                <th>Kontak</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Dibuat</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>

                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={6}
                                    >
                                        <RefreshCw
                                            className="is-spinning"
                                            aria-hidden="true"
                                        />

                                        Memuat data pengguna...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td
                                        className="table-message"
                                        colSpan={6}
                                    >
                                        <UserCog aria-hidden="true" />

                                        Tidak ada pengguna yang sesuai.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const presentation =
                                        rolePresentation[user.role] ?? {
                                            label: user.role,
                                            className: "is-manager",
                                        };

                                    const isCurrentUser =
                                        user.id === currentUser?.id;

                                    return (
                                        <tr key={user.id}>
                                            <td data-label="Pengguna">
                                                <div className="user-identity-cell">
                                                    <div className="user-table-avatar">
                                                        {user.full_name
                                                            ?.trim()
                                                            .charAt(0)
                                                            .toUpperCase() || "U"}
                                                    </div>

                                                    <div>
                                                        <strong>
                                                            {user.full_name}
                                                        </strong>

                                                        <span>
                                                            @{user.username}
                                                        </span>

                                                        {isCurrentUser && (
                                                            <small>
                                                                Akun Anda
                                                            </small>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td data-label="Kontak">
                                                <span className="user-email">
                                                    {user.email || "-"}
                                                </span>
                                            </td>

                                            <td data-label="Role">
                                                <span
                                                    className={`user-role-badge ${presentation.className}`}
                                                >
                                                    {presentation.label}
                                                </span>
                                            </td>

                                            <td data-label="Status">
                                                <span
                                                    className={`record-status ${user.status === "ACTIVE"
                                                            ? "is-active"
                                                            : "is-inactive"
                                                        }`}
                                                >
                                                    {user.status === "ACTIVE"
                                                        ? "Aktif"
                                                        : "Tidak aktif"}
                                                </span>
                                            </td>

                                            <td data-label="Dibuat">
                                                <span className="user-date">
                                                    {formatDate(
                                                        user.created_at,
                                                    )}
                                                </span>
                                            </td>

                                            <td
                                                className="table-action-cell"
                                                data-label="Aksi"
                                            >
                                                <div className="table-action-buttons user-action-buttons">
                                                    <button
                                                        type="button"
                                                        className="table-edit-action purchase-order-detail-action"
                                                        disabled={isActionBusy}
                                                        onClick={() =>
                                                            handleOpenDetail(user.id)
                                                        }
                                                    >
                                                        {loadingDetailId ===
                                                            user.id ? (
                                                            <RefreshCw
                                                                className="is-spinning"
                                                                aria-hidden="true"
                                                            />
                                                        ) : (
                                                            <Eye aria-hidden="true" />
                                                        )}

                                                        Detail
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="table-edit-action"
                                                        disabled={isActionBusy}
                                                        onClick={() =>
                                                            handleOpenEditForm(user)
                                                        }
                                                    >
                                                        <Pencil aria-hidden="true" />

                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="table-edit-action user-password-action"
                                                        disabled={isActionBusy}
                                                        onClick={() =>
                                                            handleOpenPasswordDialog(
                                                                user,
                                                            )
                                                        }
                                                    >
                                                        <KeyRound aria-hidden="true" />

                                                        Password
                                                    </button>

                                                    {!isCurrentUser && (
                                                        <button
                                                            type="button"
                                                            className={`table-status-action ${user.status === "ACTIVE"
                                                                    ? "is-deactivate"
                                                                    : "is-activate"
                                                                }`}
                                                            disabled={isActionBusy}
                                                            onClick={() =>
                                                                handleOpenStatusDialog(
                                                                    user,
                                                                )
                                                            }
                                                        >
                                                            {user.status ===
                                                                "ACTIVE" ? (
                                                                <PowerOff aria-hidden="true" />
                                                            ) : (
                                                                <Power aria-hidden="true" />
                                                            )}

                                                            {user.status === "ACTIVE"
                                                                ? "Nonaktifkan"
                                                                : "Aktifkan"}
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

            {isUserFormOpen && (
                <UserFormModal
                    key={selectedUser?.id ?? "create"}
                    isOpen
                    mode={selectedUser ? "edit" : "create"}
                    user={selectedUser}
                    currentUserId={currentUser?.id}
                    isSubmitting={isSubmitting}
                    requestError={formError}
                    onClose={handleCloseUserForm}
                    onSubmit={handleSaveUser}
                />
            )}

            {isDetailOpen && (
                <UserDetailDialog
                    isOpen
                    user={detailUser}
                    currentUserId={currentUser?.id}
                    onClose={handleCloseDetail}
                />
            )}

            {isPasswordDialogOpen && (
                <UserPasswordDialog
                    key={passwordUser?.id}
                    isOpen
                    user={passwordUser}
                    isSubmitting={isResettingPassword}
                    requestError={passwordError}
                    onClose={handleClosePasswordDialog}
                    onSubmit={handleResetPassword}
                />
            )}

            {isStatusDialogOpen && (
                <StatusConfirmDialog
                    isOpen
                    entityLabel="pengguna"
                    entityName={statusUser?.full_name ?? ""}
                    identifierLabel="username"
                    identifierValue={
                        statusUser?.username ?? ""
                    }
                    currentStatus={statusUser?.status ?? ""}
                    isSubmitting={isUpdatingStatus}
                    requestError={statusError}
                    onCancel={handleCloseStatusDialog}
                    onConfirm={handleConfirmUserStatus}
                />
            )}
        </div>
    );
};

export default UsersPage;
