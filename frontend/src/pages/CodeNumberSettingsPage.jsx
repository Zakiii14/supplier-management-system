import {
  Hash,
  RefreshCw,
  Save,
  Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getCodeNumberSettingsRequest,
  updateCodeNumberSettingRequest,
} from "../api/codeNumberSettings";
import "../styles/code-number-settings.css";

const formatPreview = (setting) => {
  const now = new Date();
  const parts = [setting.prefix || "KODE"];

  if (setting.include_year) {
    parts.push(String(now.getFullYear()));
  }

  if (setting.include_month) {
    parts.push(
      String(now.getMonth() + 1).padStart(2, "0"),
    );
  }

  parts.push(
    String(setting.next_number || 1).padStart(
      Number(setting.digit_length) || 1,
      "0",
    ),
  );

  return parts.join(setting.separator ?? "-");
};

const CodeNumberSettingsPage = () => {
  const [settings, setSettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successKey, setSuccessKey] = useState("");

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSettings(await getCodeNumberSettingsRequest());
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Pengaturan penomoran gagal dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    getCodeNumberSettingsRequest()
      .then((result) => {
        if (!isCancelled) {
          setSettings(result);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(
            error.response?.data?.message ||
              "Pengaturan penomoran gagal dimuat.",
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const updateDraft = (moduleKey, changes) => {
    setSettings((currentSettings) =>
      currentSettings.map((setting) =>
        setting.module_key === moduleKey
          ? { ...setting, ...changes }
          : setting,
      ),
    );
    setSuccessKey("");
  };

  const handleSave = async (setting) => {
    try {
      setSavingKey(setting.module_key);
      setErrorMessage("");
      setSuccessKey("");

      const updated =
        await updateCodeNumberSettingRequest(
          setting.module_key,
          {
            is_automatic: setting.is_automatic,
            prefix: setting.prefix,
            separator: setting.separator,
            digit_length: Number(setting.digit_length),
            include_year: setting.include_year,
            include_month: setting.include_month,
            reset_rule: setting.reset_rule,
            next_number: Number(setting.next_number),
          },
        );

      setSettings((currentSettings) =>
        currentSettings.map((current) =>
          current.module_key === updated.module_key
            ? updated
            : current,
        ),
      );
      setSuccessKey(updated.module_key);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Pengaturan penomoran gagal disimpan.",
      );
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="code-settings-page">
      <section className="code-settings-heading">
        <div>
          <span className="page-eyebrow">Administration</span>
          <h1>Pengaturan Penomoran</h1>
          <p>
            Atur format kode otomatis untuk setiap master
            data dan dokumen transaksi.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          disabled={isLoading || Boolean(savingKey)}
        >
          <RefreshCw aria-hidden="true" />
          Muat ulang
        </button>
      </section>

      <section className="code-settings-note">
        <Settings2 aria-hidden="true" />
        <p>
          Perubahan hanya berlaku untuk data baru. Kode pada
          data yang sudah tersimpan tidak akan diubah.
        </p>
      </section>

      {errorMessage && (
        <div className="code-settings-error" role="alert">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="code-settings-loading">
          Memuat pengaturan penomoran...
        </div>
      ) : (
        <div className="code-settings-grid">
          {settings.map((setting) => (
            <article
              className="code-setting-card"
              key={setting.module_key}
            >
              <header>
                <div className="code-setting-icon">
                  <Hash aria-hidden="true" />
                </div>
                <div>
                  <h2>{setting.module_label}</h2>
                  <span>{setting.field_name}</span>
                </div>

                <label className="code-setting-switch">
                  <input
                    type="checkbox"
                    checked={setting.is_automatic}
                    onChange={(event) =>
                      updateDraft(setting.module_key, {
                        is_automatic: event.target.checked,
                      })
                    }
                  />
                  <span>
                    {setting.is_automatic
                      ? "Otomatis"
                      : "Manual"}
                  </span>
                </label>
              </header>

              <div className="code-setting-preview">
                <span>Contoh kode berikutnya</span>
                <strong>{formatPreview(setting)}</strong>
              </div>

              <div className="code-setting-form-grid">
                <label>
                  <span>Prefix</span>
                  <input
                    value={setting.prefix}
                    maxLength={12}
                    onChange={(event) =>
                      updateDraft(setting.module_key, {
                        prefix: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>

                <label>
                  <span>Pemisah</span>
                  <select
                    value={setting.separator}
                    onChange={(event) =>
                      updateDraft(setting.module_key, {
                        separator: event.target.value,
                      })
                    }
                  >
                    <option value="-">Tanda hubung (-)</option>
                    <option value="/">Garis miring (/)</option>
                    <option value=".">Titik (.)</option>
                    <option value="">Tanpa pemisah</option>
                  </select>
                </label>

                <label>
                  <span>Jumlah digit</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={setting.digit_length}
                    onChange={(event) =>
                      updateDraft(setting.module_key, {
                        digit_length: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>Nomor berikutnya</span>
                  <input
                    type="number"
                    min="1"
                    value={setting.next_number}
                    onChange={(event) =>
                      updateDraft(setting.module_key, {
                        next_number: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>Reset nomor</span>
                  <select
                    value={setting.reset_rule}
                    onChange={(event) => {
                      const resetRule = event.target.value;
                      updateDraft(setting.module_key, {
                        reset_rule: resetRule,
                        include_year:
                          resetRule !== "NEVER" ||
                          setting.include_year,
                        include_month:
                          resetRule === "MONTHLY",
                      });
                    }}
                  >
                    <option value="NEVER">Tidak pernah</option>
                    <option value="YEARLY">Setiap tahun</option>
                    <option value="MONTHLY">Setiap bulan</option>
                  </select>
                </label>

                <div className="code-setting-tokens">
                  <span>Token tanggal</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={setting.include_year}
                      disabled={setting.reset_rule !== "NEVER"}
                      onChange={(event) =>
                        updateDraft(setting.module_key, {
                          include_year: event.target.checked,
                          include_month: event.target.checked
                            ? setting.include_month
                            : false,
                        })
                      }
                    />
                    Tahun
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={setting.include_month}
                      disabled={
                        !setting.include_year ||
                        setting.reset_rule === "YEARLY"
                      }
                      onChange={(event) =>
                        updateDraft(setting.module_key, {
                          include_month: event.target.checked,
                        })
                      }
                    />
                    Bulan
                  </label>
                </div>
              </div>

              <footer>
                <span>
                  {successKey === setting.module_key
                    ? "Pengaturan tersimpan."
                    : `Nomor terakhir: ${setting.last_number}`}
                </span>
                <button
                  type="button"
                  disabled={savingKey === setting.module_key}
                  onClick={() => handleSave(setting)}
                >
                  <Save aria-hidden="true" />
                  {savingKey === setting.module_key
                    ? "Menyimpan..."
                    : "Simpan"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default CodeNumberSettingsPage;
