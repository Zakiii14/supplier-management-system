import {
  AlertTriangle,
  BarChart3,
  FileBarChart,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  WalletCards,
  Warehouse,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getReportOptionsRequest,
  getReportRequest,
} from "../api/reports";
import DateRangeFilter from "../components/filters/DateRangeFilter";
import FormSelect from "../components/forms/FormSelect";
import ReportSummaryCards from "../components/reports/ReportSummaryCards";
import ReportTable from "../components/reports/ReportTable";
import ReportTrendChart from "../components/reports/ReportTrendChart";
import PaginationBar from "../components/tables/PaginationBar";
import useAuth from "../hooks/useAuth";
import useStickyDataFilters from "../hooks/useStickyDataFilters";
import "../styles/purchase-orders.css";
import "../styles/reports.css";
import {
  getAvailableReports,
  REPORT_CONFIG,
} from "../utils/reportConfig";
import {
  formatNumber,
} from "../utils/formatters";

const PAGE_LIMIT = 10;

const EMPTY_REPORT_DATA = {
  generated_at: "",
  filters: {},
  summary: {},
  trend: [],
  rows: [],
};

const REPORT_ICONS = {
  purchasing: ShoppingCart,
  inventory: Warehouse,
  sales: TrendingUp,
  finance: WalletCards,
};

const mapReportOptions = (
  optionType,
  items,
  defaultLabel,
) => {
  const fieldConfig = {
    supplier: {
      code: "supplier_code",
      name: "supplier_name",
    },
    category: {
      code: "category_code",
      name: "category_name",
    },
    customer: {
      code: "customer_code",
      name: "customer_name",
    },
  }[optionType];

  if (!fieldConfig) {
    return [];
  }

  return [
    {
      value: "",
      label: defaultLabel,
      searchText: defaultLabel,
    },
    ...items.map((item) => {
      const code = item[fieldConfig.code];
      const name = item[fieldConfig.name];
      const label = `${code} — ${name}`;

      return {
        value: item.id,
        label,
        searchText: `${code} ${name}`,
      };
    }),
  ];
};

const ReportsPage = () => {
  const filtersRef = useStickyDataFilters();
  const { user } = useAuth();

  const availableReports = useMemo(
    () => getAvailableReports(user?.role),
    [user?.role],
  );

  const [
    selectedReportType,
    setSelectedReportType,
  ] = useState("");

  const activeReportType =
    availableReports.some(
      (report) =>
        report.type === selectedReportType,
    )
      ? selectedReportType
      : availableReports[0]?.type || "";

  const activeConfig =
    REPORT_CONFIG[activeReportType];

  const entityType =
    activeConfig?.entityType || "";
  const entityLabel =
    activeConfig?.entityLabel || "";
  const entityParam =
    activeConfig?.entityParam || "";

  const [reportData, setReportData] =
    useState(EMPTY_REPORT_DATA);

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
  const [entityId, setEntityId] =
    useState("");
  const [dateFrom, setDateFrom] =
    useState("");
  const [dateTo, setDateTo] =
    useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] =
    useState(0);

  const [entityOptions, setEntityOptions] =
    useState([]);
  const [
    isEntityOptionsLoading,
    setIsEntityOptionsLoading,
  ] = useState(false);
  const [
    entityOptionsError,
    setEntityOptionsError,
  ] = useState("");

  const [isLoading, setIsLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!entityType) {
      return undefined;
    }

    let isCancelled = false;

    const fetchEntityOptions = async () => {
      try {
        setIsEntityOptionsLoading(true);
        setEntityOptionsError("");

        const items =
          await getReportOptionsRequest(
            entityType,
          );

        if (!isCancelled) {
          setEntityOptions(
            mapReportOptions(
              entityType,
              items,
              `Semua ${entityLabel.toLocaleLowerCase(
                "id-ID",
              )}`,
            ),
          );
        }
      } catch (error) {
        if (!isCancelled) {
          setEntityOptions([
            {
              value: "",
              label: `Semua ${entityLabel.toLocaleLowerCase(
                "id-ID",
              )}`,
            },
          ]);

          setEntityOptionsError(
            error.response?.data?.message ||
              `Pilihan ${entityLabel.toLocaleLowerCase(
                "id-ID",
              )} gagal dimuat.`,
          );
        }
      } finally {
        if (!isCancelled) {
          setIsEntityOptionsLoading(false);
        }
      }
    };

    fetchEntityOptions();

    return () => {
      isCancelled = true;
    };
  }, [entityLabel, entityType]);

  useEffect(() => {
    if (!activeReportType || !activeConfig) {
      return undefined;
    }

    let isCancelled = false;

    const fetchReport = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const params = {
          page,
          limit: PAGE_LIMIT,
          ...(appliedSearch && {
            search: appliedSearch,
          }),
          ...(status && {
            [activeConfig.statusParam]:
              status,
          }),
          ...(entityId &&
            entityParam && {
              [entityParam]: entityId,
            }),
          ...(dateFrom && {
            date_from: dateFrom,
          }),
          ...(dateTo && {
            date_to: dateTo,
          }),
        };

        const response =
          await getReportRequest(
            activeReportType,
            params,
          );

        if (!isCancelled) {
          setReportData(response.data);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (!isCancelled) {
          setReportData(EMPTY_REPORT_DATA);
          setPagination({
            page,
            limit: PAGE_LIMIT,
            total: 0,
            total_pages: 0,
          });

          setErrorMessage(
            error.response?.data?.message ||
              "Data laporan gagal dimuat. Silakan coba kembali.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchReport();

    return () => {
      isCancelled = true;
    };
  }, [
    activeConfig,
    activeReportType,
    appliedSearch,
    dateFrom,
    dateTo,
    entityId,
    entityParam,
    page,
    reloadKey,
    status,
  ]);

  const handleReportChange = (
    nextReportType,
  ) => {
    if (
      nextReportType === activeReportType
    ) {
      return;
    }

    setSelectedReportType(nextReportType);
    setSearchInput("");
    setAppliedSearch("");
    setStatus("");
    setEntityId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setReportData(EMPTY_REPORT_DATA);
    setErrorMessage("");
    setEntityOptionsError("");
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleStatusChange = (
    nextStatus,
  ) => {
    setPage(1);
    setStatus(nextStatus);
  };

  const handleEntityChange = (
    nextEntityId,
  ) => {
    setPage(1);
    setEntityId(nextEntityId);
  };

  const handleDateFromChange = (
    nextDateFrom,
  ) => {
    setPage(1);
    setDateFrom(nextDateFrom);
  };

  const handleDateToChange = (
    nextDateTo,
  ) => {
    setPage(1);
    setDateTo(nextDateTo);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setStatus("");
    setEntityId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(appliedSearch) ||
    Boolean(status) ||
    Boolean(entityId) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const statusOptions = [
    {
      value: "",
      label: "Semua status",
    },
    ...(activeConfig?.statusOptions || []),
  ];

  const totalPages = Math.max(
    pagination.total_pages,
    1,
  );

  if (!activeConfig) {
    return (
      <div className="reports-page">
        <div
          className="data-error"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" />

          <div>
            <strong>
              Reports tidak tersedia
            </strong>

            <span>
              Role pengguna tidak memiliki akses
              laporan.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="purchase-orders-page reports-page">
      <section className="page-heading">
        <div>
          <p>Analytics</p>

          <h2>Reports</h2>

          <span>
            Pantau ringkasan, tren, dan detail
            operasional dalam satu halaman.
          </span>
        </div>

        <div className="page-heading-actions">
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

      <section
        className="report-tabs"
        role="tablist"
        aria-label="Jenis laporan"
      >
        {availableReports.map((report) => {
          const Icon =
            REPORT_ICONS[report.type] ||
            FileBarChart;
          const isActive =
            report.type === activeReportType;

          return (
            <button
              key={report.type}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                isActive ? "is-active" : ""
              }
              onClick={() =>
                handleReportChange(report.type)
              }
            >
              <Icon aria-hidden="true" />

              <span>
                <strong>{report.label}</strong>
                <small>
                  {report.description}
                </small>
              </span>
            </button>
          );
        })}
      </section>

      <section className="data-panel report-filter-panel">
        <div className="report-active-heading">
          <div>
            <BarChart3 aria-hidden="true" />

            <div>
              <h3>{activeConfig.title}</h3>
              <p>{activeConfig.description}</p>
            </div>
          </div>
        </div>

        <form
          ref={filtersRef}
          className="data-filters purchase-order-filters report-filters"
          onSubmit={handleSearch}
        >
          <div className="search-control">
            <Search aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              placeholder="Cari nomor, kode, atau nama"
              aria-label={`Cari ${activeConfig.label} report`}
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
            />

            <button type="submit">
              Cari
            </button>
          </div>

          <FormSelect
            label={activeConfig.statusLabel}
            value={status}
            options={statusOptions}
            placeholder="Semua status"
            searchable={false}
            disabled={isLoading}
            onChange={handleStatusChange}
          />

          <FormSelect
            label={entityLabel}
            value={entityId}
            options={entityOptions}
            placeholder={
              isEntityOptionsLoading
                ? "Memuat pilihan..."
                : `Semua ${entityLabel.toLocaleLowerCase(
                    "id-ID",
                  )}`
            }
            searchPlaceholder={`Cari ${entityLabel.toLocaleLowerCase(
              "id-ID",
            )}...`}
            disabled={
              isLoading ||
              isEntityOptionsLoading
            }
            onChange={handleEntityChange}
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
            onDateFromChange={
              handleDateFromChange
            }
            onDateToChange={handleDateToChange}
          />
        </form>

        {entityOptionsError && (
          <div
            className="report-option-warning"
            role="alert"
          >
            <AlertTriangle aria-hidden="true" />
            <span>{entityOptionsError}</span>
          </div>
        )}

        {errorMessage && (
          <div
            className="data-error"
            role="alert"
          >
            <AlertTriangle aria-hidden="true" />

            <div>
              <strong>
                Laporan tidak dapat ditampilkan
              </strong>

              <span>{errorMessage}</span>
            </div>
          </div>
        )}
      </section>

      <ReportSummaryCards
        summary={reportData.summary}
      />

      <ReportTrendChart
        trend={reportData.trend}
      />

      <section className="report-section report-table-section">
        <div className="report-section-heading">
          <div>
            <FileBarChart aria-hidden="true" />

            <div>
              <h3>Detail laporan</h3>
              <p>
                Data rinci berdasarkan filter yang
                diterapkan.
              </p>
            </div>
          </div>
        </div>

        <div className="table-summary report-table-summary">
          <p>
            Menampilkan{" "}
            <strong>
              {reportData.rows.length}
            </strong>{" "}
            dari{" "}
            <strong>
              {formatNumber(pagination.total)}
            </strong>{" "}
            data
          </p>
        </div>

        <ReportTable
          rows={reportData.rows}
          isLoading={isLoading}
        />

        <PaginationBar
          page={page}
          totalPages={totalPages}
          isLoading={isLoading}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
};

export default ReportsPage;