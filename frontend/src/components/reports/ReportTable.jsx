import {
  Eye,
  FileBarChart,
  RefreshCw,
} from "lucide-react";
import {
  formatReportValue,
  getReportFieldLabel,
  getVisibleReportColumns,
} from "../../utils/reportFormatting";

const ReportTable = ({
  rows = [],
  isLoading = false,
  loadingDetailId = "",
  onViewDetails,
}) => {
  const columns =
    getVisibleReportColumns(rows);
  const canViewDetails =
    typeof onViewDetails === "function";

  const columnCount = Math.max(
    columns.length + (canViewDetails ? 1 : 0),
    1,
  );

  return (
    <div className="data-table-wrapper report-table-wrapper">
      <table className="data-table report-table">
        {columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((field) => (
                <th key={field}>
                  {getReportFieldLabel(field)}
                </th>
              ))}

              {canViewDetails && <th>Aksi</th>}
            </tr>
          </thead>
        )}

        <tbody>
          {isLoading ? (
            <tr>
              <td
                className="table-message"
                colSpan={columnCount}
              >
                <RefreshCw
                  className="is-spinning"
                  aria-hidden="true"
                />

                Memuat data laporan...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                className="table-message"
                colSpan={columnCount}
              >
                <FileBarChart aria-hidden="true" />

                Tidak ada data laporan yang sesuai.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={
                  row.id ||
                  `${rowIndex}-${columns
                    .map(
                      (field) =>
                        row[field] ?? "",
                    )
                    .join("-")}`
                }
              >
                {columns.map((field) => {
                  const isStatus =
                    field === "status" ||
                    field.endsWith("_status");

                  return (
                    <td
                      key={field}
                      data-label={getReportFieldLabel(
                        field,
                      )}
                    >
                      {isStatus ? (
                        <span
                          className={`report-status is-${String(
                            row[field] || "unknown",
                          )
                            .toLocaleLowerCase(
                              "id-ID",
                            )
                            .replaceAll("_", "-")}`}
                        >
                          {formatReportValue(
                            field,
                            row[field],
                          )}
                        </span>
                      ) : (
                        <strong className="report-cell-value">
                          {formatReportValue(
                            field,
                            row[field],
                          )}
                        </strong>
                      )}
                    </td>
                  );
                })}

                {canViewDetails && (
                  <td
                    className="table-action-cell"
                    data-label="Aksi"
                  >
                    <button
                      type="button"
                      className="table-edit-action purchase-order-detail-action"
                      disabled={Boolean(
                        loadingDetailId,
                      )}
                      onClick={() =>
                        onViewDetails(row)
                      }
                    >
                      {loadingDetailId === row.id ? (
                        <RefreshCw
                          className="is-spinning"
                          aria-hidden="true"
                        />
                      ) : (
                        <Eye aria-hidden="true" />
                      )}

                      {loadingDetailId === row.id
                        ? "Memuat..."
                        : "Rincian"}
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ReportTable;
