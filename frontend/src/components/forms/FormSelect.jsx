import {
  Check,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

const normalizeSearchValue = (value) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID");

const FormSelect = ({
  label,
  value,
  options = [],
  placeholder = "Pilih data",
  searchPlaceholder = "Cari pilihan...",
  searchable = true,
  disabled = false,
  onChange,
}) => {
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionRefs = useRef([]);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] =
    useState("");

  const selectedOption = options.find(
    (option) => option.value === value,
  );

  const normalizedQuery =
    normalizeSearchValue(searchQuery);

  const filteredOptions = normalizedQuery
    ? options.filter((option) => {
        const searchableValue =
          option.searchText ?? option.label;

        return normalizeSearchValue(
          searchableValue,
        ).includes(normalizedQuery);
      })
    : options;

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
        setSearchQuery("");
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

  useEffect(() => {
    if (!isOpen || !searchable) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(
      () => {
        searchInputRef.current?.focus();
      },
    );

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen, searchable]);

  // useEffect(() => {
  //   if (disabled) {
  //     setIsOpen(false);
  //     setSearchQuery("");
  //   }
  // }, [disabled]);

  const closeMenu = () => {
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }

    if (
      !isOpen ||
      ![
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      return;
    }

    const optionElements =
      optionRefs.current
        .slice(0, filteredOptions.length)
        .filter(Boolean);

    if (optionElements.length === 0) {
      return;
    }

    event.preventDefault();

    const currentIndex = optionElements.indexOf(
      document.activeElement,
    );

    let nextIndex = 0;

    if (event.key === "ArrowDown") {
      nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex + 1) %
            optionElements.length;
    }

    if (event.key === "ArrowUp") {
      nextIndex =
        currentIndex < 0
          ? optionElements.length - 1
          : (currentIndex -
              1 +
              optionElements.length) %
            optionElements.length;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = optionElements.length - 1;
    }

    optionElements[nextIndex]?.focus();
  };

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    closeMenu();
  };

  const handleTriggerClick = () => {
    if (isOpen) {
      closeMenu();
      return;
    }

    setIsOpen(true);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
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
        aria-label={label}
        disabled={disabled}
        onClick={handleTriggerClick}
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
        <div className="form-select-menu">
          {searchable && options.length > 0 && (
            <div className="form-select-search">
              <Search aria-hidden="true" />

              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                placeholder={searchPlaceholder}
                aria-label={`Cari ${String(
                  label || "pilihan",
                ).toLocaleLowerCase("id-ID")}`}
                autoComplete="off"
                disabled={disabled}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  disabled={disabled}
                  onClick={handleClearSearch}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          <div
            className="form-select-options"
            role="listbox"
            aria-label={label}
          >
            {options.length === 0 ? (
              <div className="form-select-empty">
                Tidak ada pilihan tersedia
              </div>
            ) : filteredOptions.length === 0 ? (
              <div
                className="form-select-empty"
                aria-live="polite"
              >
                Pilihan tidak ditemukan
              </div>
            ) : (
              filteredOptions.map(
                (option, index) => {
                  const isSelected =
                    option.value === value;

                  return (
                    <button
                      key={option.value}
                      ref={(element) => {
                        optionRefs.current[index] =
                          element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`form-select-option ${
                        isSelected
                          ? "is-selected"
                          : ""
                      }`}
                      disabled={disabled}
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
                },
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormSelect;