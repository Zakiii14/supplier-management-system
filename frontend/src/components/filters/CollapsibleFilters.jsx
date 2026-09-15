import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

const CollapsibleFilters = forwardRef(function CollapsibleFilters(
  {
    active = false,
    children,
    className = "",
    onSubmit,
    ...formProps
  },
  forwardedRef,
) {
  const [isOpen, setIsOpen] = useState(false);
  const shellRef = useRef(null);
  const panelId = useId();

  useImperativeHandle(
    forwardedRef,
    () => shellRef.current,
  );

  useEffect(() => {
    const shellElement = shellRef.current;
    const dataPanel = shellElement?.closest(".data-panel");

    if (!shellElement || !dataPanel) {
      return undefined;
    }

    const updateFilterHeight = () => {
      dataPanel.style.setProperty(
        "--data-filters-height",
        `${Math.ceil(shellElement.getBoundingClientRect().height)}px`,
      );
    };

    updateFilterHeight();

    const resizeObserver = new ResizeObserver(updateFilterHeight);
    resizeObserver.observe(shellElement);

    return () => {
      resizeObserver.disconnect();
      dataPanel.style.removeProperty("--data-filters-height");
    };
  }, []);

  useEffect(() => {
    const sidebarElement = document.querySelector(
      ".dashboard-sidebar",
    );

    if (!sidebarElement) {
      return undefined;
    }

    const closeWhenSidebarOpens = () => {
      if (sidebarElement.classList.contains("is-open")) {
        setIsOpen(false);
      }
    };

    const sidebarObserver = new MutationObserver(
      closeWhenSidebarOpens,
    );

    sidebarObserver.observe(sidebarElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => sidebarObserver.disconnect();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key !== "Escape" || !isOpen) {
      return;
    }

    setIsOpen(false);
    shellRef.current
      ?.querySelector(".table-filter-toggle")
      ?.focus();
  };

  return (
    <div
      ref={shellRef}
      className={`table-filter-shell${isOpen ? " is-open" : ""}`}
      onKeyDown={handleKeyDown}
    >
      <div className="table-filter-toggle-row">
        <button
          type="button"
          className="table-filter-toggle"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((current) => !current)}
        >
          <SlidersHorizontal aria-hidden="true" />
          <span>Filter</span>
          {active && (
            <span
              className="table-filter-active-indicator"
              aria-label="Filter aktif"
            />
          )}
          <ChevronDown
            className={isOpen ? "is-open" : ""}
            aria-hidden="true"
          />
        </button>
      </div>

      {isOpen && (
        <form
          {...formProps}
          id={panelId}
          className={`data-filters ${className}`.trim()}
          onSubmit={onSubmit}
        >
          {children}
        </form>
      )}
    </div>
  );
});

export default CollapsibleFilters;
