import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import { getProductsRequest } from "../api/products";
import {
  formatCurrency,
  formatNumber,
} from "../utils/formatters";
import "../styles/products.css";

const PAGE_LIMIT = 10;

const ProductsPage = () => {
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

  const handleStatusChange = (event) => {
    setPage(1);
    setStatus(event.target.value);
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
      </section>

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

          <select
            value={status}
            onChange={handleStatusChange}
            aria-label="Filter status produk"
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

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
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    className="table-message"
                    colSpan="7"
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
                    colSpan="7"
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
                        className={`status-badge ${
                          product.status === "ACTIVE"
                            ? "is-active"
                            : "is-inactive"
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
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
    </div>
  );
};

export default ProductsPage;