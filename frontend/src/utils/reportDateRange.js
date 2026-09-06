const DEFAULT_REPORT_RANGE = "last_12_months";

const REPORT_RANGE_OPTIONS = [
  {
    value: "last_6_months",
    label: "6 bulan terakhir",
  },
  {
    value: "last_12_months",
    label: "12 bulan terakhir",
  },
  {
    value: "this_year",
    label: "Tahun ini",
  },
  {
    value: "custom",
    label: "Rentang khusus",
  },
  {
    value: "all",
    label: "Semua periode",
  },
];

const toLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getReportDateRange = (
  preset = DEFAULT_REPORT_RANGE,
  now = new Date(),
) => {
  if (preset === "all") {
    return {
      preset,
      dateFrom: "",
      dateTo: "",
    };
  }

  const year = now.getFullYear();
  const month = now.getMonth();

  let start;

  if (preset === "this_year") {
    start = new Date(year, 0, 1);
  } else if (
    preset === "last_6_months" ||
    preset === "last_12_months"
  ) {
    const months =
      preset === "last_6_months" ? 6 : 12;

    start = new Date(
      year,
      month - months + 1,
      1,
    );
  } else {
    throw new Error("Invalid report date range");
  }

  return {
    preset,
    dateFrom: toLocalDateString(start),
    dateTo: toLocalDateString(now),
  };
};

export {
  DEFAULT_REPORT_RANGE,
  REPORT_RANGE_OPTIONS,
  getReportDateRange,
};