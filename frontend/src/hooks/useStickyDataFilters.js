import { useEffect, useRef } from "react";

const useStickyDataFilters = () => {
  const filtersRef = useRef(null);

  useEffect(() => {
    const filtersElement = filtersRef.current;

    if (!filtersElement) {
      return undefined;
    }

    const dataPanel =
      filtersElement.closest(".data-panel");

    if (!dataPanel) {
      return undefined;
    }

    const updateFilterHeight = () => {
      const filterHeight = Math.ceil(
        filtersElement.getBoundingClientRect().height,
      );

      dataPanel.style.setProperty(
        "--data-filters-height",
        `${filterHeight}px`,
      );
    };

    updateFilterHeight();

    const resizeObserver = new ResizeObserver(
      updateFilterHeight,
    );

    resizeObserver.observe(filtersElement);

    return () => {
      resizeObserver.disconnect();

      dataPanel.style.removeProperty(
        "--data-filters-height",
      );
    };
  }, []);

  return filtersRef;
};

export default useStickyDataFilters;