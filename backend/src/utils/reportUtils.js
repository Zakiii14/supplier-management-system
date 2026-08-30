const {
  parseDateRange,
} = require("./dateRange");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeEnum = (value) =>
  normalizeText(value).toUpperCase();

const parseReportQuery = (query) => {
  const page = Number(query.page ?? "1");
  const limit = Number(query.limit ?? "10");

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return {
      error: "Invalid pagination parameters",
    };
  }

  const {
    dateFrom,
    dateTo,
    error: dateRangeError,
  } = parseDateRange(
    query.date_from ?? "",
    query.date_to ?? "",
  );

  if (dateRangeError) {
    return {
      error: dateRangeError,
    };
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    search: normalizeText(query.search),
    dateFrom,
    dateTo,
  };
};

const validateUuid = (value, label) => {
  if (value && !UUID_PATTERN.test(value)) {
    return `Invalid ${label}`;
  }

  return null;
};

const validateEnum = (
  value,
  allowedValues,
  message,
) => {
  if (value && !allowedValues.includes(value)) {
    return message;
  }

  return null;
};

const buildPagination = ({
  page,
  limit,
  total,
}) => ({
  page,
  limit,
  total,
  total_pages:
    total === 0 ? 0 : Math.ceil(total / limit),
});

const sendReportResponse = ({
  res,
  message,
  filters,
  summary,
  trend,
  rows,
  page,
  limit,
  total,
}) => {
  res.status(200).json({
    success: true,
    message,
    data: {
      generated_at: new Date().toISOString(),
      filters,
      summary,
      trend,
      rows,
    },
    pagination: buildPagination({
      page,
      limit,
      total,
    }),
  });
};

module.exports = {
  normalizeText,
  normalizeEnum,
  parseReportQuery,
  validateUuid,
  validateEnum,
  sendReportResponse,
};
