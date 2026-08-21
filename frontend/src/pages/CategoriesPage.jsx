import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  createCategoryRequest,
  getCategoriesRequest,
  updateCategoryRequest,
  updateCategoryStatusRequest,
} from "../api/categories";
import CategoryFormModal from "../components/categories/CategoryFormModal";
import CategoryStatusDialog from "../components/categories/CategoryStatusDialog";
import StatusFilter from "../components/filters/StatusFilter";
import useAuth from "../hooks/useAuth";
import "../styles/categories.css";

const PAGE_LIMIT = 10;

const CategoriesPage = () => {
  const { user } = useAuth();

  const canManageCategories = [
    "ADMIN",
    "PURCHASING",
  ].includes(user?.role);

  const [categories, setCategories] = useState([]);
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
  const [actionError, setActionError] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState(null);
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [formError, setFormError] = useState("");

  const [statusCategory, setStatusCategory] =
    useState(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] =
    useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState(false);
  const [statusError, setStatusError] =
    useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await getCategoriesRequest({
          page,
          limit: PAGE_LIMIT,
          ...(appliedSearch && {
            search: appliedSearch,
          }),
          ...(status && { status }),
        });

        if (!isCancelled) {
          setCategories(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setCategories([]);
          setErrorMessage(
            error.response?.data?.message ||
              "Kategori gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchCategories();

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
    if (!canManageCategories) {
      return;
    }

    setSelectedCategory(null);
    setFormError("");
    setActionError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (category) => {
    if (!canManageCategories) {
      return;
    }

    setSelectedCategory(category);
    setFormError("");
    setActionError("");
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setSelectedCategory(null);
    setFormError("");
  };

  const handleSaveCategory = async (payload) => {
    try {
      setIsSubmitting(true);
      setFormError("");

      if (selectedCategory) {
        await updateCategoryRequest(
          selectedCategory.id,
          payload,
        );
      } else {
        await createCategoryRequest(payload);
        setPage(1);
      }

      setIsFormOpen(false);
      setSelectedCategory(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          `Kategori gagal ${
            selectedCategory
              ? "diperbarui"
              : "ditambahkan"
          }.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStatusDialog = (category) => {
    if (!canManageCategories) {
      return;
    }

    setStatusCategory(category);
    setStatusError("");
    setActionError("");
    setIsStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    if (isUpdatingStatus) {
      return;
    }

    setIsStatusDialogOpen(false);
    setStatusCategory(null);
    setStatusError("");
  };

  const handleConfirmStatus = async (
    nextStatus,
  ) => {
    if (!statusCategory) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setStatusError("");

      await updateCategoryStatusRequest(
        statusCategory.id,
        nextStatus,
      );

      setIsStatusDialogOpen(false);
      setStatusCategory(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setStatusError(
        error.response?.data?.message ||
          "Status kategori gagal diperbarui.",
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
    <div className="categories-page">
      <section className="page-heading">
        <div>
          <p>Master Data</p>
          <h2>Categories</h2>
          <span>
            Kelola kelompok produk agar katalog dan
            persediaan tetap terorganisasi.
          </span>
        </div>

        <div className="page-heading-actions">
          {canManageCategories && (
            <button
              type="button"
              className="primary-action"
              onClick={handleOpenCreateForm}
            >
              <Plus aria-hidden="true" />
              <span>Tambah kategori</span>
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
          className="category-action-error"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <section className="data-panel">
        <form
          className="category-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              placeholder="Cari kode atau nama kategori"
              aria-label="Cari kategori"
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />

            <button type="submit">Cari</button>
          </div>

          <StatusFilter
            value={status}
            onChange={handleStatusChange}
            ariaLabel="Filter status kategori"
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
            <strong>{categories.length}</strong> dari{" "}
            <strong>{pagination.total}</strong>{" "}
            kategori
          </p>
        </div>

        <div className="data-table-wrapper">
          <table
            className={`data-table category-table ${
              canManageCategories
                ? "has-actions"
                : ""
            }`}
          >
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama kategori</th>
                <th>Status</th>
                <th>Dibuat</th>
                {canManageCategories && (
                  <th>Aksi</th>
                )}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={
                      canManageCategories ? 5 : 4
                    }
                  >
                    <RefreshCw
                      className="is-spinning"
                      aria-hidden="true"
                    />
                    Memuat data kategori...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={
                      canManageCategories ? 5 : 4
                    }
                  >
                    <Tags aria-hidden="true" />
                    Tidak ada kategori yang sesuai.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td data-label="Kode">
                      <strong className="category-code">
                        {category.category_code}
                      </strong>
                    </td>

                    <td data-label="Nama kategori">
                      <strong className="category-name">
                        {category.category_name}
                      </strong>
                    </td>

                    <td data-label="Status">
                      <span
                        className={`status-badge ${
                          category.status === "ACTIVE"
                            ? "is-active"
                            : "is-inactive"
                        }`}
                      >
                        {category.status}
                      </span>
                    </td>

                    <td data-label="Dibuat">
                      {new Intl.DateTimeFormat(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      ).format(
                        new Date(category.created_at),
                      )}
                    </td>

                    {canManageCategories && (
                      <td
                        className="table-action-cell"
                        data-label="Aksi"
                      >
                        <div className="table-action-buttons">
                          <button
                            type="button"
                            className="table-edit-action"
                            disabled={
                              isSubmitting ||
                              isUpdatingStatus
                            }
                            onClick={() =>
                              handleOpenEditForm(
                                category,
                              )
                            }
                          >
                            <Pencil aria-hidden="true" />
                            Edit
                          </button>

                          <button
                            type="button"
                            className={`table-status-action ${
                              category.status ===
                              "ACTIVE"
                                ? "is-deactivate"
                                : "is-activate"
                            }`}
                            disabled={
                              isSubmitting ||
                              isUpdatingStatus
                            }
                            onClick={() =>
                              handleOpenStatusDialog(
                                category,
                              )
                            }
                          >
                            {category.status ===
                            "ACTIVE" ? (
                              <PowerOff
                                aria-hidden="true"
                              />
                            ) : (
                              <Power
                                aria-hidden="true"
                              />
                            )}

                            {category.status === "ACTIVE"
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
              disabled={
                page >= totalPages || isLoading
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

      {isFormOpen && (
        <CategoryFormModal
          key={selectedCategory?.id ?? "create"}
          isOpen
          mode={
            selectedCategory ? "edit" : "create"
          }
          category={selectedCategory}
          isSubmitting={isSubmitting}
          requestError={formError}
          onClose={handleCloseForm}
          onSubmit={handleSaveCategory}
        />
      )}

      {isStatusDialogOpen && (
        <CategoryStatusDialog
          isOpen
          category={statusCategory}
          isSubmitting={isUpdatingStatus}
          requestError={statusError}
          onCancel={handleCloseStatusDialog}
          onConfirm={handleConfirmStatus}
        />
      )}
    </div>
  );
};

export default CategoriesPage;