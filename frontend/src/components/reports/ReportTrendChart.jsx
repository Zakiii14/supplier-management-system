import {
  BarChart3,
} from "lucide-react";
import {
  useState,
} from "react";
import {
  formatReportValue,
  getReportFieldLabel,
  getTrendMetricFields,
} from "../../utils/reportFormatting";

const ALL_METRICS = "all";

const formatPeriod = (period) => {
  if (!/^\d{4}-\d{2}$/.test(period ?? "")) {
    return period || "-";
  }

  const date = new Date(
    `${period}-01T00:00:00`,
  );

  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
  }).format(date);
};

const getMetricUnit = (field) => {
  if (
    /(_value$|_amount$|payment|invoice)/i.test(
      field,
    )
  ) {
    return "currency";
  }

  if (/(quantity|stock)/i.test(field)) {
    return "quantity";
  }

  if (
    /(orders|count|total_po|total_so)/i.test(
      field,
    )
  ) {
    return "count";
  }

  return `other:${field}`;
};

const ReportTrendChart = ({
  trend = [],
}) => {
  const metricFields =
    getTrendMetricFields(trend);

  const [
    selectedMetric,
    setSelectedMetric,
  ] = useState(ALL_METRICS);

  const activeMetric =
    selectedMetric === ALL_METRICS ||
      !metricFields.includes(selectedMetric)
      ? ALL_METRICS
      : selectedMetric;

  const displayedMetrics =
    activeMetric === ALL_METRICS
      ? metricFields
      : [activeMetric];

  const metricMaximums =
    Object.fromEntries(
      metricFields.map((field) => [
        field,
        Math.max(
          1,
          ...trend.map(
            (item) =>
              Number(item[field]) || 0,
          ),
        ),
      ]),
    );

  const displayedUnits =
    displayedMetrics.map(getMetricUnit);

  const hasSharedUnit =
    new Set(displayedUnits).size === 1;

  const useSharedScale =
    displayedMetrics.length === 1 ||
    hasSharedUnit;

  const sharedMaximum = Math.max(
    1,
    ...trend.flatMap((item) =>
      displayedMetrics.map(
        (field) =>
          Number(item[field]) || 0,
      ),
    ),
  );

  const axisMetric =
    displayedMetrics[0];

  const axisRatios =
    sharedMaximum < 4
      ? [1, 0]
      : [1, 0.75, 0.5, 0.25, 0];

  const axisTicks = axisRatios.map(
    (ratio) =>
      Math.round(sharedMaximum * ratio),
  );

  const periodWidth = Math.max(
    displayedMetrics.length * 104,
    128,
  );

  if (
    trend.length === 0 ||
    metricFields.length === 0
  ) {
    return (
      <section className="report-section report-trend-section">
        <div className="report-section-heading">
          <div>
            <BarChart3 aria-hidden="true" />

            <div>
              <h3>Tren data laporan</h3>

              <p>
                Perubahan data pada setiap
                periode laporan.
              </p>
            </div>
          </div>
        </div>

        <div className="report-empty-state">
          <BarChart3 aria-hidden="true" />

          <span>
            Belum ada data tren untuk
            ditampilkan.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="report-section report-trend-section">
      <div className="report-section-heading">
        <div>
          <BarChart3 aria-hidden="true" />

          <div>
            <h3>Tren data laporan</h3>

            <p>
              Tampilkan seluruh informasi atau
              pilih salah satu jenis data.
            </p>
          </div>
        </div>

        <div
          className="report-trend-metrics"
          aria-label="Pilih informasi tren"
        >
          <button
            type="button"
            className={
              activeMetric === ALL_METRICS
                ? "is-active"
                : ""
            }
            aria-pressed={
              activeMetric === ALL_METRICS
            }
            onClick={() =>
              setSelectedMetric(ALL_METRICS)
            }
          >
            <span
              className="report-all-indicator"
              aria-hidden="true"
            >
              {metricFields
                .slice(0, 4)
                .map((field, index) => (
                  <i
                    key={field}
                    className={`is-series-${(index % 4) + 1
                      }`}
                  />
                ))}
            </span>

            Semua informasi
          </button>

          {metricFields.map(
            (field, index) => (
              <button
                key={field}
                type="button"
                className={
                  field === activeMetric
                    ? "is-active"
                    : ""
                }
                aria-pressed={
                  field === activeMetric
                }
                onClick={() =>
                  setSelectedMetric(field)
                }
              >
                <i
                  className={`is-series-${(index % 4) + 1
                    }`}
                  aria-hidden="true"
                />

                {getReportFieldLabel(field)}
              </button>
            ),
          )}
        </div>
      </div>


      {activeMetric === ALL_METRICS && (
        <div className="report-trend-scale-note">
          <BarChart3 aria-hidden="true" />

          <span>
            {useSharedScale ? (
              <>
                Seluruh data menggunakan skala yang
                sama dari <strong>0</strong> sampai{" "}
                <strong>
                  {formatReportValue(
                    axisMetric,
                    sharedMaximum,
                  )}
                </strong>{" "}
                karena satuannya sama.
              </>
            ) : (
              <>
                Semua batang ditampilkan
                berdampingan. Tinggi setiap warna
                dibandingkan berdasarkan metriknya
                sendiri karena satuannya berbeda.
                Nilai asli tetap ditampilkan di atas
                batang.
              </>
            )}
          </span>
        </div>
      )}


      <div className="report-chart-scroll">
        <div
          className={`report-trend-chart ${activeMetric === ALL_METRICS
            ? "is-all"
            : "is-single"
            } ${useSharedScale
              ? "has-y-axis"
              : ""
            }`}
        >
          {useSharedScale && (
            <div
              className="report-trend-y-axis"
              aria-label={`Rentang nilai 0 sampai ${formatReportValue(
                axisMetric,
                sharedMaximum,
              )}`}
            >
              {axisTicks.map(
                (tick, index) => (
                  <span
                    key={`${tick}-${index}`}
                  >
                    {formatReportValue(
                      axisMetric,
                      tick,
                    )}
                  </span>
                ),
              )}
            </div>
          )}

          <div className="report-trend-periods">
            {trend.map((item) => (
              <article
                key={item.period}
                className="report-trend-period"
                style={{
                  "--report-period-width":
                    `${periodWidth}px`,
                }}
              >
                <div className="report-trend-bars">
                  {displayedMetrics.map(
                    (field) => {
                      const metricIndex =
                        metricFields.indexOf(field);

                      const seriesClass =
                        `is-series-${(metricIndex % 4) + 1
                        }`;

                      const numericValue =
                        Number(item[field]) || 0;

                      const maximumValue =
                        useSharedScale
                          ? sharedMaximum
                          : metricMaximums[field];

                      const height =
                        numericValue === 0
                          ? 0
                          : Math.max(
                            (numericValue /
                              maximumValue) *
                            100,
                            4,
                          );

                      return (
                        <div
                          key={field}
                          className="report-trend-bar-item"
                          style={{
                            "--report-bar-height": `${height}%`,
                          }}
                        >
                          <div className="report-trend-bar-track">
                            <div className="report-trend-bar-fill">
                              <span
                                className="report-trend-value"
                                title={`${getReportFieldLabel(
                                  field,
                                )}: ${formatReportValue(
                                  field,
                                  item[field],
                                )}`}
                              >
                                {formatReportValue(
                                  field,
                                  item[field],
                                )}
                              </span>

                              <span
                                className={`report-trend-bar ${seriesClass}`}
                                aria-label={`${getReportFieldLabel(
                                  field,
                                )}: ${formatReportValue(
                                  field,
                                  item[field],
                                )}`}
                              />
                            </div>
                          </div>

                          {activeMetric === ALL_METRICS && (
                            <small
                              title={getReportFieldLabel(field)}
                            >
                              {getReportFieldLabel(field)}
                            </small>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>

                <strong>
                  {formatPeriod(item.period)}
                </strong>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="report-trend-details">
        <div>
          <h4>Rincian data per periode</h4>

          <p>
            Angka pasti dari seluruh informasi
            yang ditampilkan pada tren.
          </p>
        </div>

        <div className="report-trend-details-scroll">
          <table>
            <thead>
              <tr>
                <th>Periode</th>

                {metricFields.map((field) => (
                  <th key={field}>
                    {getReportFieldLabel(field)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {trend.map((item) => (
                <tr key={item.period}>
                  <td>
                    <strong>
                      {formatPeriod(item.period)}
                    </strong>
                  </td>

                  {metricFields.map((field) => (
                    <td key={field}>
                      {formatReportValue(
                        field,
                        item[field],
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ReportTrendChart;