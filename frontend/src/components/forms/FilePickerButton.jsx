import { Upload } from "lucide-react";
import {
  forwardRef,
  useRef,
} from "react";

const FilePickerButton = forwardRef(
  function FilePickerButton(
    {
      accept,
      multiple = false,
      disabled = false,
      buttonText = "Pilih file",
      ariaLabel,
      className = "",
      icon: Icon = Upload,
      onChange,
    },
    forwardedRef,
  ) {
    const inputRef = useRef(null);

    const assignInputRef = (element) => {
      inputRef.current = element;

      if (typeof forwardedRef === "function") {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    };

    return (
      <>
        <button
          type="button"
          className={`file-picker-button ${className}`.trim()}
          aria-label={ariaLabel || buttonText}
          disabled={disabled}
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = "";
              inputRef.current.click();
            }
          }}
        >
          <Icon aria-hidden="true" />
          <span>{buttonText}</span>
        </button>

        <input
          ref={assignInputRef}
          className="file-picker-native-input"
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
        />
      </>
    );
  },
);

export default FilePickerButton;
