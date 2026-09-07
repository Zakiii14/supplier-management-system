import {
  Download,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

const formatFileSize = (size) => {
  const numericSize = Number(size) || 0;
  return numericSize >= 1024 * 1024
    ? `${(numericSize / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(numericSize / 1024))} KB`;
};

const validateFiles = (files, existingCount = 0) => {
  if (files.length + existingCount > MAX_FILES) {
    return `Maksimal ${MAX_FILES} file untuk setiap pembayaran.`;
  }
  if (files.some((file) => file.size > MAX_SIZE)) {
    return "Ukuran setiap file maksimal 5 MB.";
  }
  return "";
};

const PaymentProofPreviewDialog = ({
  source,
  name,
  mimeType,
  onClose,
}) => {
  const [previewUrl] = useState(() =>
    source ? URL.createObjectURL(source) : "",
  );

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!source) return null;

  const normalizedMimeType = mimeType || source.type || "";
  const isPdf =
    normalizedMimeType === "application/pdf" ||
    String(name).toLowerCase().endsWith(".pdf");

  return (
    <div
      className="payment-proof-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="payment-proof-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-proof-preview-title"
      >
        <header>
          <div>
            <span>Pratinjau bukti pembayaran</span>
            <h3 id="payment-proof-preview-title">{name}</h3>
          </div>
          <button type="button" aria-label="Tutup pratinjau" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="payment-proof-preview-content">
          {!previewUrl ? (
            <div className="payment-proof-preview-loading">
              Memuat pratinjau...
            </div>
          ) : isPdf ? (
            <iframe src={previewUrl} title={`Pratinjau ${name}`} />
          ) : (
            <img src={previewUrl} alt={`Pratinjau ${name}`} />
          )}
        </div>

        <footer>
          <a href={previewUrl} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" /> Buka di tab baru
          </a>
          <a href={previewUrl} download={name}>
            <Download aria-hidden="true" /> Unduh
          </a>
        </footer>
      </section>
    </div>
  );
};

const PaymentProofPicker = ({
  files,
  onChange,
  disabled = false,
  required = false,
}) => {
  const [errorMessage, setErrorMessage] = useState("");
  const [previewFile, setPreviewFile] = useState(null);

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    const validation = validateFiles(selected);
    if (validation) {
      setErrorMessage(validation);
      event.target.value = "";
      return;
    }
    setErrorMessage("");
    onChange(selected);
  };

  return (
    <div className="payment-proof-field">
      <div className="payment-proof-field-heading">
        <div>
          <span>Bukti pembayaran{required ? " *" : ""}</span>
          <small>PDF, JPG, PNG, atau WebP · maksimal 5 MB</small>
        </div>
        <label className="payment-proof-upload-button">
          <Upload aria-hidden="true" />
          Pilih file
          <input
            type="file"
            multiple
            accept={ACCEPT}
            disabled={disabled}
            onChange={handleFiles}
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="payment-proof-selected-list">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}`}>
              <FileText aria-hidden="true" />
              <span>{file.name}</span>
              <small>{formatFileSize(file.size)}</small>
              <button
                type="button"
                title={`Pratinjau ${file.name}`}
                aria-label={`Pratinjau ${file.name}`}
                disabled={disabled}
                onClick={() => setPreviewFile(file)}
              >
                <Eye aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Hapus ${file.name}`}
                disabled={disabled}
                onClick={() =>
                  onChange(files.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {errorMessage && <p className="payment-proof-error">{errorMessage}</p>}

      {previewFile && (
        <PaymentProofPreviewDialog
          source={previewFile}
          name={previewFile.name}
          mimeType={previewFile.type}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
};

const PaymentProofManager = ({
  proofs = [],
  canManage = false,
  onAdd,
  onReplace,
  onDelete,
  onOpen,
}) => {
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [replaceProofId, setReplaceProofId] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [previewProof, setPreviewProof] = useState(null);

  const run = async (key, action) => {
    try {
      setBusyKey(key);
      setErrorMessage("");
      await action();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Bukti pembayaran gagal diperbarui.",
      );
    } finally {
      setBusyKey("");
    }
  };

  const handleAdd = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const validation = validateFiles(files, proofs.length);
    if (validation) {
      setErrorMessage(validation);
      return;
    }
    if (files.length) run("add", () => onAdd(files));
  };

  const handleReplace = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !replaceProofId) return;
    const validation = validateFiles([file]);
    if (validation) {
      setErrorMessage(validation);
      return;
    }
    run(replaceProofId, () => onReplace(replaceProofId, file));
  };

  return (
    <section className="payment-proof-manager">
      <header>
        <div>
          <h3>Bukti pembayaran</h3>
          <p>Lampiran dapat dibuka, diganti, atau dihapus jika terjadi salah unggah.</p>
        </div>
        {canManage && proofs.length < MAX_FILES && (
          <button
            type="button"
            disabled={Boolean(busyKey)}
            onClick={() => addInputRef.current?.click()}
          >
            <Plus aria-hidden="true" /> Tambah bukti
          </button>
        )}
      </header>

      <input
        ref={addInputRef}
        className="payment-proof-hidden-input"
        type="file"
        multiple
        accept={ACCEPT}
        onChange={handleAdd}
      />
      <input
        ref={replaceInputRef}
        className="payment-proof-hidden-input"
        type="file"
        accept={ACCEPT}
        onChange={handleReplace}
      />

      {proofs.length === 0 ? (
        <div className="payment-proof-empty">Belum ada bukti pembayaran.</div>
      ) : (
        <div className="payment-proof-list">
          {proofs.map((proof) => {
            const FileIcon = proof.mime_type === "application/pdf"
              ? FileText
              : FileImage;
            return (
              <article key={proof.id}>
                <FileIcon aria-hidden="true" />
                <div>
                  <strong>{proof.original_name}</strong>
                  <span>
                    {formatFileSize(proof.size_bytes)}
                    {proof.uploaded_by_name
                      ? ` · ${proof.uploaded_by_name}`
                      : ""}
                  </span>
                </div>
                <div className="payment-proof-actions">
                  <button
                    type="button"
                    title="Pratinjau bukti"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      run(`open-${proof.id}`, async () => {
                        const source = await onOpen(proof.id);
                        if (!source) throw new Error("File bukti tidak tersedia");
                        setPreviewProof({
                          source,
                          name: proof.original_name,
                          mimeType: proof.mime_type,
                        });
                      })
                    }
                  >
                    <Eye aria-hidden="true" />
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        title="Ganti bukti"
                        disabled={Boolean(busyKey)}
                        onClick={() => {
                          setReplaceProofId(proof.id);
                          replaceInputRef.current?.click();
                        }}
                      >
                        <Pencil aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Hapus bukti"
                        disabled={Boolean(busyKey)}
                        onClick={() => {
                          if (window.confirm(`Hapus bukti ${proof.original_name}?`)) {
                            run(proof.id, () => onDelete(proof.id));
                          }
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {errorMessage && <p className="payment-proof-error">{errorMessage}</p>}

      {previewProof && (
        <PaymentProofPreviewDialog
          {...previewProof}
          onClose={() => setPreviewProof(null)}
        />
      )}
    </section>
  );
};

export {
  PaymentProofManager,
  PaymentProofPicker,
  PaymentProofPreviewDialog,
};
