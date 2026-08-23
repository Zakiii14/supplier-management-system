const normalizeDateInput = (value) =>
  typeof value === "string"
    ? value.trim()
    : "";

const isValidDateInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(
    `${value}T00:00:00.000Z`,
  );

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
};

const parseDateRange = (
  dateFromValue,
  dateToValue,
) => {
  const dateFrom =
    normalizeDateInput(dateFromValue);

  const dateTo =
    normalizeDateInput(dateToValue);

  if (dateFrom && !isValidDateInput(dateFrom)) {
    return {
      error:
        "date_from must be a valid date in YYYY-MM-DD format",
    };
  }

  if (dateTo && !isValidDateInput(dateTo)) {
    return {
      error:
        "date_to must be a valid date in YYYY-MM-DD format",
    };
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return {
      error:
        "date_from cannot be later than date_to",
    };
  }

  return {
    dateFrom,
    dateTo,
    error: "",
  };
};

module.exports = {
  parseDateRange,
};