import {
  Eye,
  EyeOff,
  Save,
  UserCog,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import FormSelect from "../forms/FormSelect";

const roleOptions = [
  {
    value: "ADMIN",
    label: "Administrator",
  },
  {
    value: "PURCHASING",
    label: "Purchasing",
  },
  {
    value: "WAREHOUSE",
    label: "Warehouse",
  },
  {
    value: "SALES",
    label: "Sales",
  },
  {
    value: "FINANCE",
    label: "Finance",
  },
  {
    value: "MANAGER",
    label: "Manager",
  },
];

const statusOptions = [
  {
    value: "ACTIVE",
    label: "Aktif",
  },
  {
    value: "INACTIVE",
    label: "Tidak aktif",
  },
];

const emptyValues = {
  username: "",
  full_name: "",
  email: "",
  role: "",
  status: "ACTIVE",
  password: "",
  password_confirmation: "",
};

const createInitialValues = (user) => {
  if (!user) {
    return emptyValues;
  }

  return {
    username: user.username ?? "",
    full_name: user.full_name ?? "",
    email: user.email ?? "",
    role: user.role ?? "",
    status: user.status ?? "ACTIVE",
    password: "",
    password_confirmation: "",
  };
};

const UserFormModal = ({
  isOpen,
  mode = "create",
  user = null,
  currentUserId = "",
  isSubmitting = false,
  requestError = "",
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState(() =>
    createInitialValues(user),
  );

  const [validationError, setValidationError] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !isSubmitting
      ) {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const isEditMode = mode === "edit";
  const isEditingCurrentUser =
    isEditMode && user?.id === currentUserId;

  const handleChange = (event) => {
    const { name, value } = event.target;

    const normalizedValue =
      name === "username"
        ? value.toLowerCase().replace(/\s+/g, "")
        : value;

    setValues((currentValues) => ({
      ...currentValues,
      [name]: normalizedValue,
    }));

    setValidationError("");
  };

  const handleRoleChange = (role) => {
    setValues((currentValues) => ({
      ...currentValues,
      role,
    }));

    setValidationError("");
  };

  const handleStatusChange = (status) => {
    setValues((currentValues) => ({
      ...currentValues,
      status,
    }));

    setValidationError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      !values.full_name.trim() ||
      !values.role ||
      !values.status ||
      (!isEditMode && !values.username.trim())
    ) {
      setValidationError(
        "Username, nama lengkap, role, dan status wajib diisi.",
      );
      return;
    }

    const normalizedEmail =
      values.email.trim().toLowerCase();

    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail,
      )
    ) {
      setValidationError(
        "Format email tidak valid.",
      );
      return;
    }

    if (!isEditMode) {
      if (values.password.length < 8) {
        setValidationError(
          "Password harus terdiri dari minimal 8 karakter.",
        );
        return;
      }

      if (
        values.password !==
        values.password_confirmation
      ) {
        setValidationError(
          "Konfirmasi password tidak sesuai.",
        );
        return;
      }
    }

    const payload = {
      full_name: values.full_name.trim(),
      email: normalizedEmail || null,
      role: values.role,
      status: values.status,
    };

    if (!isEditMode) {
      payload.username =
        values.username.trim().toLowerCase();
      payload.password = values.password;
    }

    onSubmit(payload);
  };

  const title = isEditMode
    ? "Edit pengguna"
    : "Tambah pengguna";

  return (
    <div
      className="product-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className="product-modal user-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
      >
        <header className="product-modal-header">
          <div>
            <span className="product-modal-eyebrow">
              Administration
            </span>

            <h2 id="user-form-title">{title}</h2>
          </div>

          <button
            type="button"
            className="product-modal-close"
            aria-label="Tutup form pengguna"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="product-form"
          onSubmit={handleSubmit}
        >
          <div className="user-form-content">
            <div className="user-form-intro">
              <UserCog aria-hidden="true" />

              <div>
                <strong>
                  {isEditMode
                    ? "Perbarui akses pengguna"
                    : "Buat akun pengguna baru"}
                </strong>

                <span>
                  Role menentukan modul yang dapat
                  diakses oleh pengguna.
                </span>
              </div>
            </div>

            <div className="product-form-grid">
              <label className="product-form-field">
                <span>Username</span>

                <input
                  type="text"
                  name="username"
                  value={values.username}
                  placeholder="Contoh: finance01"
                  autoComplete="username"
                  disabled={
                    isSubmitting || isEditMode
                  }
                  onChange={handleChange}
                />

                {isEditMode && (
                  <small>
                    Username tidak dapat diubah.
                  </small>
                )}
              </label>

              <label className="product-form-field">
                <span>Nama lengkap</span>

                <input
                  type="text"
                  name="full_name"
                  value={values.full_name}
                  placeholder="Masukkan nama lengkap"
                  autoComplete="name"
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </label>

              <label className="product-form-field product-form-field-full">
                <span>Email</span>

                <input
                  type="email"
                  name="email"
                  value={values.email}
                  placeholder="pengguna@contoh.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </label>

              <div className="product-form-field">
                <FormSelect
                  label="Role pengguna"
                  value={values.role}
                  placeholder="Pilih role"
                  searchable={false}
                  disabled={
                    isSubmitting ||
                    isEditingCurrentUser
                  }
                  options={roleOptions}
                  onChange={handleRoleChange}
                />

                {isEditingCurrentUser && (
                  <small>
                    Role akun sendiri tidak dapat
                    diubah.
                  </small>
                )}
              </div>

              <div className="product-form-field">
                <FormSelect
                  label="Status akun"
                  value={values.status}
                  placeholder="Pilih status"
                  searchable={false}
                  disabled={
                    isSubmitting ||
                    isEditingCurrentUser
                  }
                  options={statusOptions}
                  onChange={handleStatusChange}
                />

                {isEditingCurrentUser && (
                  <small>
                    Akun yang sedang digunakan tidak
                    dapat dinonaktifkan.
                  </small>
                )}
              </div>

              {!isEditMode && (
                <>
                  <label className="product-form-field">
                    <span>Password</span>

                    <div className="user-password-input">
                      <input
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        name="password"
                        value={values.password}
                        placeholder="Minimal 8 karakter"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                        onChange={handleChange}
                      />

                      <button
                        type="button"
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                        disabled={isSubmitting}
                        onClick={() =>
                          setShowPassword(
                            (current) => !current,
                          )
                        }
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </label>

                  <label className="product-form-field">
                    <span>Konfirmasi password</span>

                    <div className="user-password-input">
                      <input
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        name="password_confirmation"
                        value={
                          values.password_confirmation
                        }
                        placeholder="Ulangi password"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                        onChange={handleChange}
                      />

                      <button
                        type="button"
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                        disabled={isSubmitting}
                        onClick={() =>
                          setShowPassword(
                            (current) => !current,
                          )
                        }
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </label>
                </>
              )}
            </div>

            {(validationError || requestError) && (
              <div
                className="product-form-error"
                role="alert"
              >
                {validationError || requestError}
              </div>
            )}
          </div>

          <footer className="product-form-actions">
            <button
              type="button"
              className="product-form-cancel"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </button>

            <button
              type="submit"
              className="product-form-submit"
              disabled={isSubmitting}
            >
              <Save aria-hidden="true" />

              {isSubmitting
                ? "Menyimpan..."
                : isEditMode
                  ? "Simpan perubahan"
                  : "Tambah pengguna"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default UserFormModal;
