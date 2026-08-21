const currencyFormatter = new Intl.NumberFormat(
  "id-ID",
  {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
);

const numberFormatter = new Intl.NumberFormat(
  "id-ID",
);

const dateFormatter = new Intl.DateTimeFormat(
  "id-ID",
  {
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
);

const formatCurrency = (value) => {
  const numberValue = Number(value);

  return currencyFormatter.format(
    Number.isFinite(numberValue) ? numberValue : 0,
  );
};

const formatNumber = (value) => {
  const numberValue = Number(value);

  return numberFormatter.format(
    Number.isFinite(numberValue) ? numberValue : 0,
  );
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "-"
    : dateFormatter.format(date);
};

export {
  formatCurrency,
  formatDate,
  formatNumber,
};