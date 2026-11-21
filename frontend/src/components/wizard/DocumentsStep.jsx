import { useRef, useState } from "react";
import { UPLOAD_RULES } from "../../api/config";
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

export default function DocumentsStep({
  draft,
  mode = "documents",
  onBack,
  onContinue,
  hideFooter = false,
}) {
  const isImages = mode === "images";
  const category = isImages ? "image" : "document";
  const categoryLabel = isImages ? "photo" : "document";
  const acceptedTypes = isImages
    ? ".jpg,.jpeg,.png,image/jpeg,image/png"
    : ".pdf,application/pdf";
  const files = draft.files.filter((file) => file.category === category);
  const fileMessages = draft.fileMessages.filter((message) => message.category === category);
  const { addFiles, removeFile, prefilledFields } = draft;
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const prefilledCount = isImages ? 0 : Object.keys(prefilledFields || {}).length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const extractingCount = files.filter((f) => f.extractionStatus === "extracting").length;
  const failedCount = files.filter((f) => f.status === "error").length;
  const extractionFailedCount = files.filter((f) => f.extractionStatus === "failed").length;
  const stillUploading = uploadingCount > 0 || extractingCount > 0;
  const fileLabel = isImages ? "photo" : "document";
  const uploadStatus = [
    uploadingCount > 0 && `Uploading ${uploadingCount} of ${files.length} ${fileLabel}${files.length === 1 ? "" : "s"}.`,
    extractingCount > 0 && `Extracting fields from ${extractingCount} document${extractingCount === 1 ? "" : "s"}.`,
    failedCount > 0 && `${failedCount} upload${failedCount === 1 ? "" : "s"} failed.`,
    extractionFailedCount > 0 && `Extraction failed for ${extractionFailedCount} document${extractionFailedCount === 1 ? "" : "s"}; verify the details manually.`,
  ].filter(Boolean).join(" ") || `All ${files.length} ${fileLabel}${files.length === 1 ? "" : "s"} uploaded.`;

  function handleFiles(list) {
    addFiles(list, category);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleContinue() {
    onContinue();
  }

  return (
    <Card
      title={isImages ? "Claim photos" : "Supporting documents"}
      icon={isImages ? "image" : "upload"}
      description={
        isImages
          ? `Add up to ${UPLOAD_RULES.maxImages} JPG or PNG photos. Photos are optional when they do not apply to the claim.`
          : "Upload a PDF claim form, invoice, or report. We will extract fields to help fill the claim details."
      }
    >
      <Callout tone="info">
        <p className="small">
          {isImages
            ? "Image forensics will be marked skipped if no photos are attached. Other claim checks can still use the claim details and supporting documents."
            : "Extraction may miss details. Review every field before screening; uploaded documents can still support the other checks."}
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
          accept={acceptedTypes}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="dropzone-icon"><Icon name={isImages ? "image" : "cloud"} size={34} /></div>
        <strong>Drag and drop {isImages ? "photos" : "PDF documents"} here</strong>
        <span className="muted">or</span>
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
          Browse {isImages ? "photos" : "documents"}
        </button>
        <p className="dropzone-rules">
          {isImages
            ? `JPG or PNG · up to ${UPLOAD_RULES.maxImages} photos · 10 MB each`
            : "PDF · up to 10 MB each"}
        </p>
      </div>

      <div className="stack-sm" aria-live="polite">
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
        <strong>Selected {isImages ? "photos" : "documents"}</strong>
        <span className="count-pill">{files.length}</span>
      </div>
      {files.length ? (
        <FileList files={files} onRemove={removeFile} />
      ) : (
        <EmptyState icon={isImages ? "image" : "file"} title={`No ${categoryLabel}s selected yet`}>
          {isImages
            ? "You can continue without photos if none are available or relevant."
            : "You can add supporting documents now or continue with claim details and add photos in the next step."}
        </EmptyState>
      )}

      {!hideFooter && (
        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <Icon name="arrowLeft" size={17} /> Back
          </button>
          <button type="button" className="btn btn-primary" onClick={handleContinue}>
            Continue <Icon name="arrow" size={17} />
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