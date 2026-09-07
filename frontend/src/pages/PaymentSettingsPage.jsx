import { RefreshCw, Save, Settings2, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getPaymentSettingsRequest,
  updatePaymentSettingsRequest,
} from "../api/paymentSettings";
import FormSelect from "../components/forms/FormSelect";
import "../styles/payments.css";

const SCHEME_OPTIONS = [
  { value: "DIRECT", label: "Pembayaran langsung" },
  { value: "TERM", label: "Termin pembayaran" },
  { value: "DOWN_PAYMENT", label: "DP dan pelunasan" },
  { value: "COD", label: "Bayar saat barang diterima (COD)" },
];

const PaymentSettingsPage = () => {
  const [values, setValues] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setValues(await getPaymentSettingsRequest());
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Pengaturan pembayaran gagal dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getPaymentSettingsRequest()
      .then((settings) => {
        if (!cancelled) setValues(settings);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error.response?.data?.message ||
              "Pengaturan pembayaran gagal dimuat.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSuccessMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setErrorMessage("");
      const updated = await updatePaymentSettingsRequest({
        default_purchase_scheme: values.default_purchase_scheme,
        default_purchase_term_days: Number(values.default_purchase_term_days),
        default_down_payment_percent: Number(values.default_down_payment_percent),
        require_purchase_transfer_proof:
          values.require_purchase_transfer_proof,
        require_sales_transfer_proof: values.require_sales_transfer_proof,
      });
      setValues(updated);
      setSuccessMessage("Pengaturan pembayaran berhasil disimpan.");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Pengaturan pembayaran gagal disimpan.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="payment-settings-page">
      <section className="page-heading">
        <div>
          <p>Administration</p>
          <h2>Pengaturan Pembayaran</h2>
          <span>
            Tentukan skema bawaan pembelian dan kewajiban bukti pembayaran.
          </span>
        </div>
        <button
          type="button"
          className="secondary-action"
          disabled={isLoading || isSaving}
          onClick={loadSettings}
        >
          <RefreshCw aria-hidden="true" /> Muat ulang
        </button>
      </section>

      <section className="payment-settings-note">
        <Settings2 aria-hidden="true" />
        <p>
          Perubahan menjadi nilai awal transaksi baru. Ketentuan pada PO dan
          pembayaran yang sudah tersimpan tidak akan diubah.
        </p>
      </section>

      {errorMessage && <div className="data-error">{errorMessage}</div>}
      {successMessage && <div className="payment-settings-success">{successMessage}</div>}

      {isLoading || !values ? (
        <div className="data-panel payment-settings-loading">
          Memuat pengaturan pembayaran...
        </div>
      ) : (
        <form className="data-panel payment-settings-form" onSubmit={handleSubmit}>
          <header>
            <WalletCards aria-hidden="true" />
            <div>
              <h3>Ketentuan bawaan</h3>
              <p>Supplier dan PO tetap dapat menggunakan ketentuan khusus.</p>
            </div>
          </header>

          <div className="payment-settings-grid">
            <FormSelect
              label="Skema pembelian"
              value={values.default_purchase_scheme}
              options={SCHEME_OPTIONS}
              searchable={false}
              onChange={(value) => updateValue("default_purchase_scheme", value)}
            />
            <label>
              <span>Termin bawaan (hari)</span>
              <input
                type="number"
                min="0"
                max="365"
                value={values.default_purchase_term_days}
                onChange={(event) =>
                  updateValue("default_purchase_term_days", event.target.value)
                }
              />
            </label>
            <label>
              <span>DP bawaan (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={values.default_down_payment_percent}
                onChange={(event) =>
                  updateValue("default_down_payment_percent", event.target.value)
                }
              />
            </label>
          </div>

          <div className="payment-settings-switches">
            <label>
              <input
                type="checkbox"
                checked={values.require_purchase_transfer_proof}
                onChange={(event) =>
                  updateValue(
                    "require_purchase_transfer_proof",
                    event.target.checked,
                  )
                }
              />
              <span>
                <strong>Wajibkan bukti pembayaran supplier</strong>
                <small>Berlaku untuk transfer bank dan giro.</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={values.require_sales_transfer_proof}
                onChange={(event) =>
                  updateValue("require_sales_transfer_proof", event.target.checked)
                }
              />
              <span>
                <strong>Wajibkan bukti pembayaran pelanggan</strong>
                <small>Berlaku untuk transfer bank dan giro.</small>
              </span>
            </label>
          </div>

          <footer>
            <button type="submit" disabled={isSaving}>
              <Save aria-hidden="true" />
              {isSaving ? "Menyimpan..." : "Simpan pengaturan"}
            </button>
          </footer>
        </form>
      )}
    </div>
  );
};

export default PaymentSettingsPage;
