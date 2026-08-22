import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const weekdayLabels = [
  "Min",
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
];

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

const formatMonthLabel = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);

const isSameDay = (firstDate, secondDate) =>
  firstDate?.getFullYear() === secondDate?.getFullYear() &&
  firstDate?.getMonth() === secondDate?.getMonth() &&
  firstDate?.getDate() === secondDate?.getDate();

const startOfDay = (date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

const FormDatePicker = ({
  label,
  value,
  min = "",
  placeholder = "Pilih tanggal",
  disabled = false,
  onChange,
}) => {
  const containerRef = useRef(null);
  const selectedDate = parseDateValue(value);
  const minimumDate = parseDateValue(min);
  const today = startOfDay(new Date());

  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () =>
      new Date(
        (selectedDate || minimumDate || today).getFullYear(),
        (selectedDate || minimumDate || today).getMonth(),
        1,
      ),
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      1,
    );
    const gridStart = new Date(firstDay);

    gridStart.setDate(
      firstDay.getDate() - firstDay.getDay(),
    );

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  const handleToggle = () => {
    if (disabled) {
      return;
    }

    if (!isOpen) {
      const activeDate =
        selectedDate || minimumDate || today;

      setVisibleMonth(
        new Date(
          activeDate.getFullYear(),
          activeDate.getMonth(),
          1,
        ),
      );
    }

    setIsOpen((current) => !current);
  };

  const handleSelectDate = (date) => {
    if (
      minimumDate &&
      startOfDay(date) < startOfDay(minimumDate)
    ) {
      return;
    }

    onChange(formatDateValue(date));
    setIsOpen(false);
  };

  const handleToday = () => {
    if (minimumDate && today < startOfDay(minimumDate)) {
      return;
    }

    onChange(formatDateValue(today));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="form-date-picker"
      onKeyDown={handleKeyDown}
    >
      <span className="form-date-picker-label">
        {label}
      </span>

      <button
        type="button"
        className={`form-date-picker-trigger ${
          isOpen ? "is-open" : ""
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={handleToggle}
      >
        <span
          className={
            selectedDate
              ? "form-date-picker-value"
              : "form-date-picker-placeholder"
          }
        >
          {selectedDate
            ? formatDisplayDate(selectedDate)
            : placeholder}
        </span>

        <CalendarDays aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="form-date-picker-menu"
          role="dialog"
          aria-label={`Pilih ${label.toLowerCase()}`}
        >
          <div className="form-date-picker-heading">
            <strong>
              {formatMonthLabel(visibleMonth)}
            </strong>

            <div>
              <button
                type="button"
                aria-label="Bulan sebelumnya"
                onClick={() =>
                  setVisibleMonth(
                    (currentMonth) =>
                      new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() - 1,
                        1,
                      ),
                  )
                }
              >
                <ChevronLeft aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-label="Bulan berikutnya"
                onClick={() =>
                  setVisibleMonth(
                    (currentMonth) =>
                      new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() + 1,
                        1,
                      ),
                  )
                }
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className="form-date-picker-weekdays"
            aria-hidden="true"
          >
            {weekdayLabels.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="form-date-picker-days">
            {calendarDays.map((date) => {
              const dateValue = formatDateValue(date);
              const isOutsideMonth =
                date.getMonth() !==
                visibleMonth.getMonth();
              const isDisabled = Boolean(
                minimumDate &&
                  startOfDay(date) <
                    startOfDay(minimumDate),
              );

              return (
                <button
                  key={dateValue}
                  type="button"
                  className={`form-date-picker-day ${
                    isOutsideMonth
                      ? "is-outside"
                      : ""
                  } ${
                    isSameDay(date, today)
                      ? "is-today"
                      : ""
                  } ${
                    isSameDay(date, selectedDate)
                      ? "is-selected"
                      : ""
                  }`}
                  aria-label={formatDisplayDate(date)}
                  aria-pressed={
                    isSameDay(date, selectedDate)
                  }
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="form-date-picker-actions">
            <button
              type="button"
              disabled={!value}
              onClick={handleClear}
            >
              Hapus
            </button>

            <button
              type="button"
              disabled={Boolean(
                minimumDate &&
                  today < startOfDay(minimumDate),
              )}
              onClick={handleToday}
            >
              Hari ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormDatePicker;