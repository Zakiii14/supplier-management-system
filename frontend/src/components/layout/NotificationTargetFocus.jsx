import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const HIGHLIGHT_DURATION = 3600;
const SEARCH_TIMEOUT = 5000;

const normalize = (value) =>
  String(value ?? "").trim().toLocaleLowerCase("id-ID");

const NotificationTargetFocus = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const target = location.state?.notificationTarget;

  useEffect(() => {
    if (!target?.label) return undefined;

    const expectedLabel = normalize(target.label);
    let highlightTimer;
    let timeoutTimer;
    let searchTimer;
    let observer;
    let highlightedElement;

    const clearNavigationState = () => {
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      });
    };

    const findAndHighlight = () => {
      const candidates = document.querySelectorAll(
        ".data-table tbody tr, [data-notification-target]",
      );
      const element = [...candidates].find((candidate) =>
        normalize(candidate.textContent).includes(expectedLabel),
      );

      if (!element) return false;

      observer?.disconnect();
      window.clearTimeout(timeoutTimer);
      highlightedElement = element;
      element.classList.add("notification-target-highlight");
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      highlightTimer = window.setTimeout(
        () => {
          element.classList.remove("notification-target-highlight");
          clearNavigationState();
        },
        HIGHLIGHT_DURATION,
      );
      return true;
    };

    const applyTargetSearch = () => {
      const searchInput = document.querySelector(
        ".data-panel form .search-control input",
      );
      const form = searchInput?.closest("form");

      if (!searchInput || !form) return;

      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(searchInput, target.label);
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchTimer = window.setTimeout(() => form.requestSubmit(), 0);
    };

    const frameId = window.requestAnimationFrame(() => {
      if (findAndHighlight()) return;

      observer = new MutationObserver(findAndHighlight);
      observer.observe(document.querySelector(".dashboard-content") || document.body, {
        childList: true,
        subtree: true,
      });
      applyTargetSearch();
      timeoutTimer = window.setTimeout(() => {
        observer.disconnect();
        clearNavigationState();
      }, SEARCH_TIMEOUT);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(highlightTimer);
      window.clearTimeout(timeoutTimer);
      window.clearTimeout(searchTimer);
      observer?.disconnect();
      highlightedElement?.classList.remove("notification-target-highlight");
    };
  }, [
    location.pathname,
    location.search,
    navigate,
    target?.label,
    target?.notificationKey,
  ]);

  return null;
};

export default NotificationTargetFocus;
