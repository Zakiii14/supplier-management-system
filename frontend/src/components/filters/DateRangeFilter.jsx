import FormDatePicker from "../forms/FormDatePicker";

const DateRangeFilter = ({
  dateFrom = "",
  dateTo = "",
  disabled = false,
  onDateFromChange,
  onDateToChange,
}) => {
  const handleDateFromChange = (nextDateFrom) => {
    onDateFromChange(nextDateFrom);

    if (
      nextDateFrom &&
      dateTo &&
      nextDateFrom > dateTo
    ) {
      onDateToChange("");
    }
  };

  return (
    <div className="date-range-filter">
      <FormDatePicker
        label="Dari tanggal"
        value={dateFrom}
        placeholder="Tanggal mulai"
        disabled={disabled}
        onChange={handleDateFromChange}
      />

      <FormDatePicker
        label="Sampai tanggal"
        value={dateTo}
        min={dateFrom}
        placeholder="Tanggal akhir"
        disabled={disabled}
        onChange={onDateToChange}
      />
    </div>
  );
};

export default DateRangeFilter;