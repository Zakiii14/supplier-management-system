import { Hash, LoaderCircle } from "lucide-react";

const CodeNumberField = ({
  label,
  name,
  value,
  placeholder,
  maxLength,
  mode = "create",
  setting,
  isLoading = false,
  errorMessage = "",
  disabled = false,
  onChange,
  className = "product-form-field",
}) => {
  const isAutomatic = setting?.is_automatic;

  if (isLoading) {
    return (
      <div className={`${className} code-number-field`}>
        <span>{label}</span>
        <div className="code-number-preview is-loading">
          <LoaderCircle aria-hidden="true" />
          Memuat pengaturan kode...
        </div>
      </div>
    );
  }

  if (isAutomatic) {
    return (
      <div className={`${className} code-number-field`}>
        <span>{label}</span>
        <div className="code-number-preview">
          <Hash aria-hidden="true" />
          <div>
            <strong>
              {mode === "create" ? setting.preview : value}
            </strong>
            <small>
              {mode === "create"
                ? "Dibuat otomatis saat data disimpan."
                : "Kode lama dipertahankan saat data diperbarui."}
            </small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <label className={`${className} code-number-field`}>
      <span>{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        disabled={disabled}
        onChange={onChange}
      />
      {errorMessage && (
        <small className="code-number-warning">
          {errorMessage} Masukkan kode secara manual.
        </small>
      )}
    </label>
  );
};

export default CodeNumberField;
