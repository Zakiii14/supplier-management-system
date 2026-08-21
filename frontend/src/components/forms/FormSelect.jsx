import {
  Check,
  ChevronDown,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

const FormSelect = ({
  label,
  value,
  options = [],
  placeholder = "Pilih data",
  disabled = false,
  onChange,
}) => {
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(
    (option) => option.value === value,
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (
        !containerRef.current?.contains(
          event.target,
        )
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

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="form-select"
      onKeyDown={handleKeyDown}
    >
      <span className="form-select-label">
        {label}
      </span>

      <button
        type="button"
        className={`form-select-trigger ${
          isOpen ? "is-open" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() =>
          setIsOpen((current) => !current)
        }
      >
        <span
          className={
            selectedOption
              ? "form-select-value"
              : "form-select-placeholder"
          }
        >
          {selectedOption?.label || placeholder}
        </span>

        <ChevronDown aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="form-select-menu"
          role="listbox"
          aria-label={label}
        >
          {options.length === 0 ? (
            <div className="form-select-empty">
              Tidak ada pilihan tersedia
            </div>
          ) : (
            options.map((option) => {
              const isSelected =
                option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`form-select-option ${
                    isSelected
                      ? "is-selected"
                      : ""
                  }`}
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
            })
          )}
        </div>
      )}
    </div>
  );
};

export default FormSelect;