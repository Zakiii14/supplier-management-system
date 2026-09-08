import { useEffect, useId, useState } from "react";
import { getDashboardTrendsRequest } from "../../api/dashboard";
import FormSelect from "../forms/FormSelect";

const COLORS = ["#2563eb", "#059669"];

const numberFormatter = new Intl.NumberFormat(
  "id-ID",
  { maximumFractionDigits: 2 },
);

const monthFormatter = new Intl.DateTimeFormat(
  "id-ID",
  {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  },
);

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatValue = (value, format) => {
  const text = numberFormatter.format(
    toNumber(value),
  );

  return format === "currency"
    ? `Rp ${text}`
    : text;
};

const formatPeriod = (period) => {
  const date = new Date(`${period}-01T00:00:00Z`);

  return Number.isNaN(date.getTime())
    ? period
    : monthFormatter.format(date);
};

const createSmoothPath = (points) => {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middleX = (previous.x + point.x) / 2;

    // Titik kontrol selalu berada di antara dua nilai data.
    // Kurva tetap halus tanpa melewati nilai minimum/maksimum segmen.
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
};

const DashboardTrendChart = ({
  reloadKey = 0,
}) => {
  const titleId = useId();

  const [months, setMonths] = useState(6);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedPeriod, setSelectedPeriod] =
    useState("");
  const [isTooltipVisible, setIsTooltipVisible] =
    useState(false);
  const [tooltipX, setTooltipX] = useState(null);
  const [result, setResult] = useState(null);

  const requestKey =
    `${months}:${reloadKey}:${retryKey}`;

  useEffect(() => {
    const controller = new AbortController();

    const fetchTrends = async () => {
      try {
        const data =
          await getDashboardTrendsRequest(
            months,
            controller.signal,
          );

        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data,
            error: "",
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data: null,
            error:
              "Grafik tren gagal dimuat. Silakan coba kembali.",
          });
        }
      }
    };

    fetchTrends();

    return () => controller.abort();
  }, [months, requestKey]);

  const isLoading = result?.key !== requestKey;
  const data = isLoading ? null : result?.data;
  const error = isLoading ? "" : result?.error;

  const metrics = data?.metrics ?? [];
  const rows = data?.trend ?? [];

  const values = rows.flatMap((row) =>
    metrics.map((metric) =>
      toNumber(row[metric.field]),
    ),
  );

  const maximum = Math.max(0, ...values);
  const minimum = Math.min(0, ...values);

  // Data seluruhnya nol tetap memiliki area grafik.
  const axisMaximum =
    maximum === 0 && minimum === 0
      ? 1
      : maximum;

  const axisRange = axisMaximum - minimum;

  // Sumbu, garis, dan titik memakai koordinat yang sama.
  const width = Math.max(
    760,
    200 + Math.max(rows.length - 1, 1) * 82,
  );
  const height = 330;
  const left = 160;
  const right = width - 40;
  const top = 35;
  const bottom = 265;

  const getX = (index) =>
    rows.length <= 1
      ? (left + right) / 2
      : left +
      (index / (rows.length - 1)) *
      (right - left);

  const getY = (value) =>
    bottom -
    ((toNumber(value) - minimum) / axisRange) *
    (bottom - top);

  const ticks = Array.from(
    { length: 5 },
    (_, index) =>
      minimum + (axisRange * index) / 4,
  );

  const selectedIndex = rows.findIndex(
    (row) => row.period === selectedPeriod,
  );

  const activeIndex =
    selectedIndex >= 0
      ? selectedIndex
      : rows.length - 1;

  const activeRow = rows[activeIndex];
  const hasData =
    rows.length > 0 && metrics.length > 0;

  const selectNearestPeriod = (event) => {
    if (rows.length === 0) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    if (rect.width === 0) {
      return;
    }

    const pointerX =
      ((event.clientX - rect.left) / rect.width) *
      width;

    setTooltipX(Math.max(left, Math.min(right, pointerX)));

    const ratio =
      (pointerX - left) / (right - left);

    const index = Math.max(
      0,
      Math.min(
        rows.length - 1,
        Math.round(ratio * (rows.length - 1)),
      ),
    );

    setSelectedPeriod(rows[index].period);
  };

  const handleChartKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? rows.length - 1
        : Math.max(
          0,
          Math.min(
            rows.length - 1,
            currentIndex + (event.key === "ArrowRight" ? 1 : -1),
          ),
        );

    setSelectedPeriod(rows[nextIndex].period);
    setTooltipX(getX(nextIndex));
    setIsTooltipVisible(true);
  };

  return (
    <section
      className="dashboard-panel dashboard-trend"
      aria-labelledby={titleId}
      aria-busy={isLoading}
    >
      <div className="dashboard-trend-heading">
        <div>
          <p className="dashboard-trend-eyebrow">
            Perkembangan bulanan
          </p>

          <h2 id={titleId}>
            {data?.title || "Tren operasional"}
          </h2>

          <p className="dashboard-trend-description">
            {data?.description ||
              "Pantau perkembangan data sesuai akses akunmu."}
          </p>
        </div>

        <div
          className="dashboard-trend-range"
          role="group"
          aria-label="Rentang grafik"
        >
          {[6, 12].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={months === value}
              onClick={() => setMonths(value)}
            >
              {value} bulan terakhir
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p
          className="dashboard-trend-state"
          role="status"
        >
          Memuat grafik tren...
        </p>
      )}

      {error && (
        <div
          className="dashboard-trend-state"
          role="alert"
        >
          <p>{error}</p>

          <button
            className="dashboard-trend-retry"
            type="button"
            onClick={() =>
              setRetryKey((current) => current + 1)
            }
          >
            Coba lagi
          </button>
        </div>
      )}

      {data && !hasData && (
        <p className="dashboard-trend-state">
          Data tren belum tersedia.
        </p>
      )}

      {data && hasData && (
        <>
          <div className="dashboard-trend-legend">
            {metrics.map((metric, index) => (
              <span key={metric.field}>
                <i
                  aria-hidden="true"
                  style={{
                    background:
                      COLORS[index % COLORS.length],
                  }}
                />
                {metric.label}
                {index === 1 }
              </span>
            ))}
          </div>

          <p className="dashboard-trend-hint">
            {metrics[0]?.format === "currency"
              ? "Sumbu vertikal menunjukkan nilai dalam rupiah."
              : "Sumbu vertikal menunjukkan jumlah unit barang."}{" "}
            Seluruh garis menggunakan skala yang sama.
            Bulan berjalan masih dapat bertambah.
          </p>

          {maximum === 0 && minimum === 0 && (
            <p className="dashboard-trend-zero">
              Seluruh nilai pada rentang ini masih 0.
            </p>
          )}

          <div
            className="dashboard-trend-scroll"
            role="region"
            aria-label="Grafik tren bulanan, dapat digeser ke samping"
            tabIndex={0}
            onFocus={() => setIsTooltipVisible(true)}
            onBlur={() => setIsTooltipVisible(false)}
            onKeyDown={handleChartKeyDown}
          >
            <div
              className="dashboard-trend-canvas"
              style={{ width: `${width}px` }}
              onPointerEnter={(event) => {
                setIsTooltipVisible(true);
                selectNearestPeriod(event);
              }}
              onPointerMove={selectNearestPeriod}
              onPointerLeave={() => setIsTooltipVisible(false)}
              onClick={selectNearestPeriod}
            >
              <svg
                className="dashboard-trend-svg"
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
              <defs>
                {metrics.map((metric, index) => {
                  const color = COLORS[index % COLORS.length];
                  return (
                    <linearGradient
                      id={`trend-fill-${index}`}
                      key={metric.field}
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={color} stopOpacity=".2" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  );
                })}
              </defs>
              {ticks.map((tick, index) => {
                const y = getY(tick);

                return (
                  <g key={index}>
                    <line
                      x1={left}
                      x2={right}
                      y1={y}
                      y2={y}
                      stroke="var(--sf-border)"
                    />

                    <text
                      x={left - 14}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="dashboard-trend-axis"
                    >
                      {formatValue(
                        tick,
                        metrics[0]?.format,
                      )}
                    </text>
                  </g>
                );
              })}

              <line
                x1={left}
                x2={right}
                y1={getY(0)}
                y2={getY(0)}
                stroke="var(--sf-border-strong)"
              />

              {activeRow && (
                <line
                  x1={getX(activeIndex)}
                  x2={getX(activeIndex)}
                  y1={top}
                  y2={bottom}
                  stroke="var(--sf-text-soft)"
                  strokeDasharray="4 5"
                />
              )}

              {metrics.map((metric, index) => {
                const color =
                  COLORS[index % COLORS.length];

                const points = rows.map((row, rowIndex) => ({
                  x: getX(rowIndex),
                  y: getY(row[metric.field]),
                }));
                const linePath = createSmoothPath(points);
                const areaPath = points.length
                  ? `${linePath} L ${points.at(-1).x} ${bottom} L ${points[0].x} ${bottom} Z`
                  : "";

                return (
                  <g key={metric.field}>
                    <path
                      d={areaPath}
                      fill={`url(#trend-fill-${index})`}
                      className="dashboard-trend-area"
                    />

                    <path
                      d={linePath}
                      fill="none"
                      stroke={color}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className="dashboard-trend-line"
                    />

                    {rows.map((row, rowIndex) => (
                      <circle
                        key={row.period}
                        cx={getX(rowIndex)}
                        cy={getY(row[metric.field])}
                        r={rowIndex === activeIndex ? 5 : 3.5}
                        fill={rowIndex === activeIndex ? color : "var(--sf-surface)"}
                        stroke={color}
                        strokeWidth={rowIndex === activeIndex ? 2.5 : 2}
                        className={rowIndex === activeIndex ? "is-active" : ""}
                      />
                    ))}
                  </g>
                );
              })}

              {rows.map((row, index) => (
                <text
                  key={row.period}
                  x={getX(index)}
                  y={bottom + 30}
                  textAnchor="middle"
                  className="dashboard-trend-axis"
                >
                  {formatPeriod(row.period)}
                </text>
              ))}
              </svg>

              {isTooltipVisible && activeRow && (
                <div
                  className={`dashboard-trend-tooltip ${(tooltipX ?? getX(activeIndex)) < left + 110 ? "is-start" : ""} ${(tooltipX ?? getX(activeIndex)) > right - 110 ? "is-end" : ""}`}
                  style={{ left: `${tooltipX ?? getX(activeIndex)}px` }}
                  role="status"
                  aria-live="polite"
                >
                  <strong>{formatPeriod(activeRow.period)}</strong>
                  {metrics.map((metric, index) => (
                    <span key={metric.field}>
                      <i
                        aria-hidden="true"
                        style={{ background: COLORS[index % COLORS.length] }}
                      />
                      <em>{metric.label}</em>
                      <b>{formatValue(activeRow[metric.field], metric.format)}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-trend-detail">
            <div className="dashboard-trend-detail-heading">
              <div>
                <h3>Rincian bulan terpilih</h3>
                <p>
                  Pilihan bulan mengikuti rentang
                  grafik. Arahkan penunjuk ke grafik
                  atau pilih bulan untuk melihat
                  angka lengkap.
                </p>
              </div>

              <div className="dashboard-trend-month-filter">
                <FormSelect
                  label="Bulan dalam rentang grafik"
                  value={activeRow?.period ?? ""}
                  options={rows.map((row) => ({
                    value: row.period,
                    label: formatPeriod(row.period),
                  }))}
                  placeholder="Pilih bulan"
                  searchable={false}
                  disabled={isLoading}
                  onChange={setSelectedPeriod}
                />
              </div>
            </div>

            <dl
              className="dashboard-trend-values"
              aria-live="polite"
              aria-atomic="true"
            >
              {metrics.map((metric, index) => (
                <div key={metric.field}>
                  <dt>
                    <i
                      aria-hidden="true"
                      style={{
                        background:
                          COLORS[index % COLORS.length],
                      }}
                    />
                    {metric.label}
                    {" · "}
                    {formatPeriod(activeRow.period)}
                  </dt>

                  <dd>
                    {formatValue(
                      activeRow[metric.field],
                      metric.format,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </section>
  );
};

export default DashboardTrendChart;