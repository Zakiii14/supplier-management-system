import { Percent, RefreshCw, Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getTaxSettingsRequest, updateTaxSettingsRequest } from "../api/taxSettings";
import "../styles/payments.css";

const TaxSettingsPage = () => {
  const [values, setValues] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setValues(await getTaxSettingsRequest());
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Pengaturan pajak gagal dimuat.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getTaxSettingsRequest()
      .then((settings) => { if (!cancelled) setValues(settings); })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error.response?.data?.message || "Pengaturan pajak gagal dimuat.");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
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
      const updated = await updateTaxSettingsRequest({
        is_enabled: values.is_enabled,
        tax_name: values.tax_name.trim(),
        default_rate: Number(values.default_rate),
        allow_invoice_override: values.allow_invoice_override,
      });
      setValues(updated);
      setSuccessMessage("Pengaturan pajak berhasil disimpan.");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Pengaturan pajak gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="payment-settings-page">
      <section className="page-heading">
        <div><p>Administration</p><h2>Pengaturan Pajak</h2><span>Tentukan pajak bawaan untuk invoice penjualan baru.</span></div>
        <button type="button" className="secondary-action" disabled={isLoading || isSaving} onClick={loadSettings}><RefreshCw aria-hidden="true" /> Muat ulang</button>
      </section>

      <section className="payment-settings-note"><Settings2 aria-hidden="true" /><p>Perubahan hanya menjadi nilai awal invoice baru. Invoice yang sudah tersimpan tidak akan dihitung ulang.</p></section>
      {errorMessage && <div className="data-error" role="alert">{errorMessage}</div>}
      {successMessage && <div className="payment-settings-success">{successMessage}</div>}

      {isLoading || !values ? <div className="data-panel payment-settings-loading">Memuat pengaturan pajak...</div> : (
        <form className="data-panel payment-settings-form" onSubmit={handleSubmit}>
          <header><Percent aria-hidden="true" /><div><h3>Pajak invoice penjualan</h3><p>Pajak dihitung dari nilai sales order setelah diskon.</p></div></header>
          <div className="payment-settings-grid">
            <label><span>Nama pajak</span><input type="text" maxLength="40" required value={values.tax_name} onChange={(event) => updateValue("tax_name", event.target.value)} /></label>
            <label><span>Persentase bawaan (%)</span><input type="number" min="0" max="100" step="0.01" required value={values.default_rate} onChange={(event) => updateValue("default_rate", event.target.value)} /></label>
          </div>
          <div className="payment-settings-switches">
            <label><input type="checkbox" checked={values.is_enabled} onChange={(event) => updateValue("is_enabled", event.target.checked)} /><span><strong>Aktifkan pajak invoice</strong><small>Invoice baru otomatis memakai persentase bawaan.</small></span></label>
            <label><input type="checkbox" checked={values.allow_invoice_override} disabled={!values.is_enabled} onChange={(event) => updateValue("allow_invoice_override", event.target.checked)} /><span><strong>Izinkan koreksi nominal per invoice</strong><small>Finance dapat menyesuaikan hasil perhitungan otomatis bila diperlukan.</small></span></label>
          </div>
          <footer><button type="submit" disabled={isSaving}><Save aria-hidden="true" />{isSaving ? "Menyimpan..." : "Simpan pengaturan"}</button></footer>
        </form>
      )}
    </div>
  );
};

export default TaxSettingsPage;
