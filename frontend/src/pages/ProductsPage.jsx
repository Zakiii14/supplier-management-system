import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Pencil,
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
  createProductRequest,
  getProductsRequest,
  updateProductRequest,
  updateProductStatusRequest,
} from "../api/products";
import {
  formatCurrency,
  formatNumber,
} from "../utils/formatters";
import "../styles/products.css";
import { getCategoriesRequest } from "../api/categories";
import { getActiveSuppliersRequest } from "../api/suppliers";
import ProductFormModal from "../components/products/ProductFormModal";
import ProductStatusDialog from "../components/products/ProductStatusDialog";
import StatusFilter from "../components/filters/StatusFilter";
import useAuth from "../hooks/useAuth";

const PAGE_LIMIT = 10;

const ProductsPage = () => {
  const { user } = useAuth();

  const canManageProducts = [
    "ADMIN",
    "PURCHASING",
  ].includes(user?.role);
  const [products, setProducts] = useState([]);
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
  const [lowStockOnly, setLowStockOnly] =
    useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [isProductFormOpen, setIsProductFormOpen] =
    useState(false);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedProduct, setSelectedProduct] =
    useState(null);
  const [isPreparingForm, setIsPreparingForm] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusProduct, setStatusProduct] =
    useState(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] =
    useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState(false);
  const [statusError, setStatusError] =
    useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await getProductsRequest({
          page,
          limit: PAGE_LIMIT,
          ...(appliedSearch && {
            search: appliedSearch,
          }),
          ...(status && { status }),
          ...(lowStockOnly && {
            low_stock: "true",
          }),
        });

        if (!isCancelled) {
          setProducts(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setProducts([]);
          setErrorMessage(
            error.response?.data?.message ||
            "Produk gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      isCancelled = true;
    };
  }, [
    page,
    appliedSearch,
    status,
    lowStockOnly,
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

  const handleLowStockChange = (event) => {
    setPage(1);
    setLowStockOnly(event.target.checked);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setStatus("");
    setLowStockOnly(false);
    setPage(1);
  };

  const loadProductOptions = async (product = null) => {
    const [categoryData, supplierData] =
      await Promise.all([
        getCategoriesRequest(),
        getActiveSuppliersRequest(),
      ]);

    const availableCategories = categoryData.filter(
      (category) =>
        category.status === "ACTIVE" ||
        category.id === product?.category_id,
    );

    const availableSuppliers = [...supplierData];

    if (
      product?.supplier_id &&
      !availableSuppliers.some(
        (supplier) =>
          supplier.id === product.supplier_id,
      )
    ) {
      availableSuppliers.push({
        id: product.supplier_id,
        supplier_name: product.supplier_name,
      });
    }

    setCategories(availableCategories);
    setSuppliers(availableSuppliers);
  };

  const handleOpenCreateForm = async () => {
    if (!canManageProducts) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");

      await loadProductOptions();

      setSelectedProduct(null);
      setIsProductFormOpen(true);
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
        "Kategori dan supplier gagal dimuat.",
      );
    } finally {
      setIsPreparingForm(false);
    }
  };

  const handleOpenEditForm = async (product) => {
    if (!canManageProducts) {
      return;
    }

    try {
      setIsPreparingForm(true);
      setActionError("");
      setFormError("");

      await loadProductOptions(product);

      setSelectedProduct(product);
      setIsProductFormOpen(true);
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
        "Data pendukung produk gagal dimuat.",
      );
    } finally {
      setIsPreparingForm(false);
    }
  };

  const handleCloseProductForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsProductFormOpen(false);
    setSelectedProduct(null);
    setFormError("");
  };

  const handleSaveProduct = async (payload) => {
    try {
      setIsSubmitting(true);
      setFormError("");

      if (selectedProduct) {
        await updateProductRequest(
          selectedProduct.id,
          payload,
        );
      } else {
        await createProductRequest(payload);
        setPage(1);
      }

      setIsProductFormOpen(false);
      setSelectedProduct(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
        `Produk gagal ${selectedProduct ? "diperbarui" : "ditambahkan"
        }.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStatusDialog = (product) => {
    if (!canManageProducts) {
      return;
    }

    setStatusProduct(product);
    setStatusError("");
    setIsStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    if (isUpdatingStatus) {
      return;
    }

    setIsStatusDialogOpen(false);
    setStatusProduct(null);
    setStatusError("");
  };

  const handleConfirmProductStatus = async (
    nextStatus,
  ) => {
    if (!statusProduct) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setStatusError("");

      await updateProductStatusRequest(
        statusProduct.id,
        nextStatus,
      );

      setIsStatusDialogOpen(false);
      setStatusProduct(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setStatusError(
        error.response?.data?.message ||
        "Status produk gagal diperbarui.",
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
    lowStockOnly;

  return (
    <div className="products-page">
      <section className="page-heading">
        <div>
          <p>Master Data</p>
          <h2>Products</h2>
          <span>
            Pantau katalog, harga, supplier, dan kondisi
            stok produk.
          </span>
        </div>

        <div className="page-heading-actions">
          {canManageProducts && (
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
                  : "Tambah produk"}
              </span>
            </button>
          )}

          <button
            type="button"
            className="secondary-action"
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
            disabled={isLoading}
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
        <div className="product-action-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <section className="data-panel">
        <form
          className="product-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Cari SKU, produk, kategori, atau supplier"
              aria-label="Cari produk"
            />

            <button type="submit">
              Cari
            </button>
          </div>

          <StatusFilter
            value={status}
            onChange={handleStatusChange}
            ariaLabel="Filter status produk"
          />

          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={handleLowStockChange}
            />
            <span>Low stock</span>
          </label>

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

        <div className="table-summary">
          <p>
            Menampilkan{" "}
            <strong>{products.length}</strong> dari{" "}
            <strong>
              {formatNumber(pagination.total)}
            </strong>{" "}
            produk
          </p>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produk</th>
                <th>Kategori & Supplier</th>
                <th>Stok</th>
                <th>Harga Beli</th>
                <th>Harga Jual</th>
                <th>Status</th>
                {canManageProducts && <th>Aksi</th>}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={canManageProducts ? 8 : 7}
                  >
                    <RefreshCw
                      className="is-spinning"
                      aria-hidden="true"
                    />
                    Memuat data produk...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan={canManageProducts ? 8 : 7}
                  >
                    <PackageSearch aria-hidden="true" />
                    Tidak ada produk yang sesuai.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id}>
                    <td data-label="SKU">
                      <strong className="sku-text">
                        {product.sku}
                      </strong>
                    </td>

                    <td data-label="Produk">
                      <div className="product-name-cell">
                        <strong>
                          {product.product_name}
                        </strong>
                        <span>{product.unit}</span>
                      </div>
                    </td>

                    <td data-label="Kategori & Supplier">
                      <div className="product-relation-cell">
                        <strong>
                          {product.category_name}
                        </strong>
                        <span>
                          {product.supplier_name}
                        </span>
                      </div>
                    </td>

                    <td data-label="Stok">
                      <div className="stock-cell">
                        <strong>
                          {formatNumber(
                            product.current_stock,
                          )}{" "}
                          {product.unit}
                        </strong>

                        {product.is_low_stock && (
                          <span className="stock-warning">
                            Low stock
                          </span>
                        )}
                      </div>
                    </td>

                    <td data-label="Harga Beli">
                      {formatCurrency(
                        product.purchase_price,
                      )}
                    </td>

                    <td data-label="Harga Jual">
                      {formatCurrency(
                        product.selling_price,
                      )}
                    </td>

                    <td data-label="Status">
                      <span
                        className={`status-badge ${product.status === "ACTIVE"
                          ? "is-active"
                          : "is-inactive"
                          }`}
                      >
                        {product.status}
                      </span>
                    </td>

                    {canManageProducts && (
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
                              handleOpenEditForm(product)
                            }
                          >
                            <Pencil aria-hidden="true" />
                            Edit
                          </button>

                          <button
                            type="button"
                            className={`table-status-action ${product.status === "ACTIVE"
                              ? "is-deactivate"
                              : "is-activate"
                              }`}
                            disabled={
                              isPreparingForm || isUpdatingStatus
                            }
                            onClick={() =>
                              handleOpenStatusDialog(product)
                            }
                          >
                            {product.status === "ACTIVE" ? (
                              <PowerOff aria-hidden="true" />
                            ) : (
                              <Power aria-hidden="true" />
                            )}

                            {product.status === "ACTIVE"
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
              onClick={() =>
                setPage((current) =>
                  Math.max(current - 1, 1),
                )
              }
              disabled={page <= 1 || isLoading}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft aria-hidden="true" />
              Sebelumnya
            </button>

            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(current + 1, totalPages),
                )
              }
              disabled={
                page >= totalPages || isLoading
              }
              aria-label="Halaman berikutnya"
            >
              Berikutnya
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
      {isProductFormOpen && (
        <ProductFormModal
          key={selectedProduct?.id ?? "create"}
          isOpen
          mode={selectedProduct ? "edit" : "create"}
          product={selectedProduct}
          categories={categories}
          suppliers={suppliers}
          isSubmitting={isSubmitting}
          requestError={formError}
          onClose={handleCloseProductForm}
          onSubmit={handleSaveProduct}
        />
      )}
      {isStatusDialogOpen && (
        <ProductStatusDialog
          isOpen
          product={statusProduct}
          isSubmitting={isUpdatingStatus}
          requestError={statusError}
          onCancel={handleCloseStatusDialog}
          onConfirm={handleConfirmProductStatus}
        />
      )}
    </div>
  );
};

export default ProductsPage;