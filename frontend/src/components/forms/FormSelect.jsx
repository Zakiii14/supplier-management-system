import {
  Check,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 12;
const MENU_GAP = 7;
const MENU_CHROME_HEIGHT = 12;
const SEARCH_CHROME_HEIGHT = 60;
const OPTION_HEIGHT = 44;
const MAX_VISIBLE_OPTIONS = 6;
const MIN_OPTIONS_HEIGHT = 48;

const normalizeSearchValue = (value) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID");

const OptionContent = ({ option }) => {
  if (!option?.code) {
    return option?.label;
  }

  return (
    <span className="form-select-option-content">
      <span className="form-select-option-code">
        {option.code}
      </span>

      <span className="form-select-option-name">
        {option.label}
      </span>
    </span>
  );
};

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
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionRefs = useRef([]);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] =
    useState("");
  const [menuPosition, setMenuPosition] =
    useState(null);

  const selectedOption = options.find(
    (option) => option.value === value,
  );

  const normalizedQuery =
    normalizeSearchValue(searchQuery);

  const filteredOptions = normalizedQuery
    ? options.filter((option) => {
        const searchableValue =
          option.searchText ??
          [option.code, option.label]
            .filter(Boolean)
            .join(" ");

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
        ) &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setMenuPosition(null);
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

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updateMenuPosition = () => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const viewportWidth =
        document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;

      if (
        rect.bottom <= VIEWPORT_MARGIN ||
        rect.top >=
          viewportHeight - VIEWPORT_MARGIN
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setMenuPosition(null);
        return;
      }

      const menuWidth = Math.min(
        rect.width,
        viewportWidth - VIEWPORT_MARGIN * 2,
      );
      const menuLeft = Math.min(
        Math.max(rect.left, VIEWPORT_MARGIN),
        viewportWidth - menuWidth - VIEWPORT_MARGIN,
      );
      const spaceBelow = Math.max(
        0,
        viewportHeight -
          rect.bottom -
          MENU_GAP -
          VIEWPORT_MARGIN,
      );
      const spaceAbove = Math.max(
        0,
        rect.top - MENU_GAP - VIEWPORT_MARGIN,
      );
      const desiredOptionsHeight = Math.min(
        Math.max(filteredOptions.length, 1) *
          OPTION_HEIGHT,
        OPTION_HEIGHT * MAX_VISIBLE_OPTIONS,
      );
      const chromeHeight =
        (searchable && options.length > 0
          ? SEARCH_CHROME_HEIGHT
          : 0) + MENU_CHROME_HEIGHT;
      const desiredMenuHeight =
        desiredOptionsHeight + chromeHeight;
      const opensUpward =
        spaceBelow < desiredMenuHeight &&
        spaceAbove > spaceBelow;
      const availableSpace = opensUpward
        ? spaceAbove
        : spaceBelow;
      const optionsMaxHeight = Math.max(
        MIN_OPTIONS_HEIGHT,
        Math.min(
          desiredOptionsHeight,
          availableSpace - chromeHeight,
        ),
      );
      const estimatedMenuHeight =
        optionsMaxHeight + chromeHeight;
      const menuTop = opensUpward
        ? Math.max(
            VIEWPORT_MARGIN,
            rect.top - MENU_GAP - estimatedMenuHeight,
          )
        : rect.bottom + MENU_GAP;

      setMenuPosition({
        left: menuLeft,
        maxOptionsHeight: optionsMaxHeight,
        placement: opensUpward ? "top" : "bottom",
        top: menuTop,
        width: menuWidth,
      });
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener(
      "scroll",
      updateMenuPosition,
      true,
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateMenuPosition,
      );
      window.removeEventListener(
        "scroll",
        updateMenuPosition,
        true,
      );
    };
  }, [
    filteredOptions.length,
    isOpen,
    options.length,
    searchable,
  ]);

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
    setMenuPosition(null);
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
          {selectedOption ? (
            <OptionContent option={selectedOption} />
          ) : (
            placeholder
          )}
        </span>

        <ChevronDown aria-hidden="true" />
      </button>

      {isOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className="form-select-menu is-floating"
            data-placement={menuPosition.placement}
            style={{
              "--form-select-options-max-height":
                `${menuPosition.maxOptionsHeight}px`,
              left: `${menuPosition.left}px`,
              top: `${menuPosition.top}px`,
              width: `${menuPosition.width}px`,
            }}
          >
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
                        <OptionContent option={option} />

                        {isSelected && (
                          <Check aria-hidden="true" />
                        )}
                      </button>
                    );
                  },
                )
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default FormSelect;
