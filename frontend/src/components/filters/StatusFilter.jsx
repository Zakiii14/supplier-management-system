import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
} from "lucide-react";

const statusOptions = [
  {
    value: "",
    label: "Semua status",
  },
  {
    value: "ACTIVE",
    label: "Active",
  },
  {
    value: "INACTIVE",
    label: "Inactive",
  },
];

const StatusFilter = ({
  value,
  onChange,
  ariaLabel = "Filter status",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const listboxId = useId();

  const selectedOption =
    statusOptions.find(
      (option) => option.value === value,
    ) ?? statusOptions[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="status-filter"
    >
      <button
        type="button"
        className="status-filter-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() =>
          setIsOpen((current) => !current)
        }
      >
        <span>{selectedOption.label}</span>

        <ChevronDown
          className={isOpen ? "is-open" : ""}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          className="status-filter-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {statusOptions.map((option) => {
            const isSelected =
              option.value === value;

            return (
              <button
                key={option.value || "all"}
                type="button"
                className={`status-filter-option ${
                  isSelected ? "is-selected" : ""
                }`}
                role="option"
                aria-selected={isSelected}
                onClick={() =>
                  handleSelect(option.value)
                }
              >
                <span>{option.label}</span>

                {isSelected && (
                  <Check aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatusFilter;