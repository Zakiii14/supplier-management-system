import { useEffect, useRef } from "react";

const useModalDismiss = (isOpen, onClose, disabled = false) => {
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = disabled;
  }, [disabled, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !disabledRef.current) {
        onCloseRef.current();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);
};

export default useModalDismiss;
