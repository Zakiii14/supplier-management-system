import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  commitMasterDataImportRequest,
  downloadImportTemplateRequest,
  getImportModulesRequest,
  previewMasterDataImportRequest,
} from "../api/masterDataImports";
import FormSelect from "../components/forms/FormSelect";
import "../styles/master-data-import.css";

const formatCell = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat("id-ID").format(value);
  return String(value);
};

const MasterDataImportPage = () => {
  const fileInputRef = useRef(null);
  const [modules, setModules] = useState([]);
  const [moduleKey, setModuleKey] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    getImportModulesRequest()
      .then((data) => {
        if (!active) return;
        setModules(data);
        setModuleKey(data[0]?.key || "");
      })
      .catch((error) => {
        if (active) setMessage({ type: "error", text: error.response?.data?.message || "Daftar modul impor gagal dimuat." });
      })
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, []);

  const selectedModule = modules.find((item) => item.key === moduleKey);
  const moduleOptions = modules.map((item) => ({ value: item.key, label: item.label }));
  const visibleFields = useMemo(
    () => selectedModule?.fields?.slice(0, 6) || [],
    [selectedModule],
  );

  const resetPreview = () => {
    setFile(null);
    setPreview(null);
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleModuleChange = (value) => {
    setModuleKey(value);
    resetPreview();
  };

  const chooseFile = (selectedFile) => {
    setMessage(null);
    setPreview(null);
    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setMessage({ type: "error", text: "Pilih file Excel dengan format .xlsx." });
      return;
    }
    if (selectedFile.size > 2 * 1024 * 1024) {
      setFile(null);
      setMessage({ type: "error", text: "Ukuran file maksimal 2 MB." });
      return;
    }
    setFile(selectedFile);
  };

  const downloadTemplate = async () => {
    if (!moduleKey) return;
    try {
      setIsDownloading(true);
      setMessage(null);
      const result = await downloadImportTemplateRequest(moduleKey);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Template gagal diunduh." });
    } finally {
      setIsDownloading(false);
    }
  };

  const createPreview = async () => {
    if (!file || !moduleKey) return;
    try {
      setIsPreviewing(true);
      setMessage(null);
      setPreview(await previewMasterDataImportRequest(moduleKey, file));
    } catch (error) {
      setPreview(null);
      setMessage({ type: "error", text: error.response?.data?.message || "File gagal diperiksa." });
    } finally {
      setIsPreviewing(false);
    }
  };

  const commitImport = async () => {
    if (!preview || preview.summary.invalid > 0) return;
    try {
      setIsImporting(true);
      setMessage(null);
      const result = await commitMasterDataImportRequest(moduleKey, preview.rows);
      setMessage({ type: "success", text: result.message });
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      const updatedPreview = error.response?.data?.details;
      if (updatedPreview) setPreview(updatedPreview);
      setMessage({ type: "error", text: error.response?.data?.message || "Data gagal diimpor." });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="master-import-page">
      <section className="page-heading">
        <div>
          <p>ADMINISTRATION</p>
          <h2>Impor Master Data</h2>
          <span>Tambahkan banyak kategori, supplier, produk, atau customer melalui template Excel.</span>
        </div>
        <button type="button" className="secondary-action" onClick={resetPreview} disabled={!file && !preview}>
          <RotateCcw aria-hidden="true" /> Atur ulang
        </button>
      </section>

      <section className="master-import-note">
        <Database aria-hidden="true" />
        <p>Data diperiksa sebelum disimpan. Kode kosong akan mengikuti Pengaturan Penomoran, dan seluruh baris disimpan dalam satu transaksi.</p>
      </section>

      {message && (
        <div className={`master-import-message is-${message.type}`} role={message.type === "error" ? "alert" : "status"}>
          {message.type === "success" ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
          <span>{message.text}</span>
        </div>
      )}

      <section className="master-import-setup">
        <article className="master-import-step">
          <span className="master-import-step-number">1</span>
          <div className="master-import-step-heading">
            <h3>Pilih jenis data</h3>
            <p>Template dan aturan validasi menyesuaikan modul.</p>
          </div>
          <FormSelect
            label="Master data"
            value={moduleKey}
            options={moduleOptions}
            searchable={false}
            disabled={isLoading || isPreviewing || isImporting}
            onChange={handleModuleChange}
          />
          <button type="button" className="secondary-action master-import-download" onClick={downloadTemplate} disabled={!moduleKey || isDownloading}>
            {isDownloading ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Download aria-hidden="true" />}
            Unduh template
          </button>
        </article>

        <article className="master-import-step">
          <span className="master-import-step-number">2</span>
          <div className="master-import-step-heading">
            <h3>Unggah file</h3>
            <p>Gunakan template tanpa mengubah nama kolom.</p>
          </div>
          <label
            className={`master-import-dropzone${file ? " has-file" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={(event) => chooseFile(event.target.files[0])} />
            {file ? <FileSpreadsheet aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}
            <strong>{file ? file.name : "Pilih atau tarik file Excel"}</strong>
            <span>{file ? `${Math.max(1, Math.ceil(file.size / 1024))} KB` : "Format .xlsx, maksimal 2 MB dan 500 baris"}</span>
          </label>
          <button type="button" className="primary-action master-import-preview-action" onClick={createPreview} disabled={!file || isPreviewing || isImporting}>
            {isPreviewing ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
            Periksa data
          </button>
        </article>
      </section>

      {preview && (
        <section className="master-import-preview">
          <header>
            <div>
              <p>PRATINJAU IMPOR</p>
              <h3>Hasil pemeriksaan {selectedModule?.label}</h3>
            </div>
            <div className="master-import-summary" aria-label="Ringkasan validasi">
              <span><strong>{preview.summary.total}</strong> total</span>
              <span className="is-valid"><strong>{preview.summary.valid}</strong> valid</span>
              <span className="is-invalid"><strong>{preview.summary.invalid}</strong> bermasalah</span>
            </div>
          </header>

          <div className="master-import-table-wrapper">
            <table className="data-table master-import-table">
              <thead><tr><th>Baris</th>{visibleFields.map((field) => <th key={field.key}>{field.label}</th>)}<th>Status</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={`${row.row_number}-${row.data[selectedModule?.fields?.[0]?.key] || "row"}`} className={row.valid ? "is-valid" : "is-invalid"}>
                    <td data-label="Baris"><strong>{row.row_number}</strong></td>
                    {visibleFields.map((field) => <td key={field.key} data-label={field.label}>{formatCell(row.data[field.key])}</td>)}
                    <td data-label="Status">
                      {row.valid ? (
                        <span className="master-import-status is-valid"><CheckCircle2 aria-hidden="true" /> Valid</span>
                      ) : (
                        <div className="master-import-row-errors">
                          <span className="master-import-status is-invalid"><AlertTriangle aria-hidden="true" /> Perlu diperbaiki</span>
                          <ul>{row.errors.map((error) => <li key={error}>{error}</li>)}</ul>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer>
            <p>{preview.summary.invalid > 0 ? "Perbaiki file Excel lalu unggah kembali sebelum menyimpan." : "Semua data valid dan siap disimpan."}</p>
            <button type="button" className="primary-action" onClick={commitImport} disabled={preview.summary.invalid > 0 || isImporting}>
              {isImporting ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Database aria-hidden="true" />}
              Impor {preview.summary.valid} data
            </button>
          </footer>
        </section>
      )}
    </div>
  );
};

export default MasterDataImportPage;
