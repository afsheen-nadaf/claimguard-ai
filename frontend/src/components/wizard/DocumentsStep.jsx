import { useRef, useState } from "react";
import Icon from "../Icon";
import { Callout, Card, EmptyState } from "../ui";
import FileList from "./FileList";

const FIELD_LABELS = {
  policyNumber: "policy number",
  claimType: "claim type",
  incidentDate: "incident date",
  amount: "claim amount",
  location: "location",
  description: "description",
};

export default function DocumentsStep({ draft, onBack, onContinue, hideFooter = false }) {
  const { files, fileMessages, addFiles, removeFile, prefilledFields } = draft;
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [needFile, setNeedFile] = useState(false);

  const prefilledCount = Object.keys(prefilledFields || {}).length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const extractingCount = files.filter((f) => f.extractionStatus === "extracting").length;
  const failedCount = files.filter((f) => f.status === "error").length;
  const extractionFailedCount = files.filter((f) => f.extractionStatus === "failed").length;
  const stillUploading = uploadingCount > 0 || extractingCount > 0;
  const uploadStatus = [
    uploadingCount > 0 && `Uploading ${uploadingCount} of ${files.length} document${files.length === 1 ? "" : "s"}.`,
    extractingCount > 0 && `Extracting fields from ${extractingCount} document${extractingCount === 1 ? "" : "s"}.`,
    failedCount > 0 && `${failedCount} upload${failedCount === 1 ? "" : "s"} failed.`,
    extractionFailedCount > 0 && `Extraction failed for ${extractionFailedCount} document${extractionFailedCount === 1 ? "" : "s"}; verify the details manually.`,
  ].filter(Boolean).join(" ") || `All ${files.length} document${files.length === 1 ? "" : "s"} uploaded. Review the extracted details before screening.`;

  function handleFiles(list) {
    setNeedFile(false);
    addFiles(list);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleContinue() {
    if (files.length === 0) {
      setNeedFile(true);
      return;
    }
    onContinue();
  }

  return (
    <Card
      title="Supporting documents"
      icon="upload"
      description="Upload forms, invoices, reports, or photos to support screening and prefill empty claim fields."
    >
      <Callout tone="info">
        <p className="small">
          Extraction may miss details. Review every field before screening; uploaded files can still support the other checks.
        </p>
      </Callout>

      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          tabIndex={-1}
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="dropzone-icon"><Icon name="cloud" size={34} /></div>
        <strong>Drag and drop files here</strong>
        <span className="muted">or</span>
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
          Browse files
        </button>
        <p className="dropzone-rules">PDF, JPG, JPEG or PNG · up to 10 MB per file</p>
      </div>

      <div className="stack-sm" aria-live="polite">
        {needFile && <Callout tone="danger">Add at least one supporting document to continue.</Callout>}
        {fileMessages.map((m, i) => (
          <Callout key={i} tone={m.tone === "error" ? "danger" : "success"}>{m.text}</Callout>
        ))}
        {prefilledCount > 0 && (
          <Callout tone="success">
            <strong>{prefilledCount} field{prefilledCount === 1 ? "" : "s"} pre-filled from document extraction.</strong>
            <p>
              {"Fields filled: "}
              {Object.entries(prefilledFields).map(([field, file], i, arr) => (
                <span key={field}>
                  {FIELD_LABELS[field] || field}{" "}
                  <span className="muted small">(from {file})</span>
                  {i < arr.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
            <p className="muted small">Review and edit these in Claim information before screening.</p>
          </Callout>
        )}
      </div>

      {files.length > 0 && (
        <div className="upload-status-wrap">
          <Callout tone={failedCount > 0 ? "danger" : extractionFailedCount > 0 ? "warning" : stillUploading ? "info" : "success"}>
            <strong>{uploadStatus}</strong>
            {stillUploading && <p className="small">You can continue reviewing the claim while these steps finish.</p>}
          </Callout>
        </div>
      )}

      <div className="section-label">
        <strong>Selected files</strong>
        <span className="count-pill">{files.length}</span>
      </div>
      {files.length ? (
        <FileList files={files} onRemove={removeFile} />
      ) : (
        <EmptyState icon="file" title="No files selected yet">
          Added documents will be listed here with their type and size.
        </EmptyState>
      )}

      {!hideFooter && (
        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <Icon name="arrowLeft" size={17} /> Back to details
          </button>
          <button type="button" className="btn btn-primary" onClick={handleContinue}>
            Review claim <Icon name="arrow" size={17} />
          </button>
          {stillUploading && (
            <span className="muted small" aria-live="polite">
              {uploadingCount > 0 ? `Uploading ${uploadingCount}…` : `Extracting ${extractingCount}…`}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}