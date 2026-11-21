import Icon from "../Icon";
import { Callout, Card, KeyValueList } from "../ui";
import FileList from "./FileList";
import { formatDate, formatINR } from "../../lib/format";
import { FIELD_ORDER } from "../../lib/validation";

const FIELD_LABELS = {
  claimType: "Claim type",
  policyNumber: "Policy number",
  incidentDate: "Incident date",
  amount: "Claim amount",
  location: "Incident location",
  description: "Incident description",
};

// Human-readable labels for the extracted-field names returned by the
// Bedrock extraction endpoint.
const EXTRACTED_FIELD_LABELS = {
  documentType: "Document type",
  claimantName: "Claimant name",
  policyNumber: "Policy number",
  claimNumber: "Claim number",
  claimType: "Claim type",
  incidentDate: "Incident date",
  submissionDate: "Submission date",
  claimAmountINR: "Claim amount",
  providerName: "Provider name",
  invoiceNumber: "Invoice number",
  incidentLocation: "Incident location",
  incidentDescription: "Incident description",
};

export function ClaimSummary({ form }) {
  return (
    <KeyValueList
      items={[
        { label: "Claim type", value: form.claimType },
        { label: "Policy number", value: form.policyNumber.trim() },
        { label: "Incident date", value: form.incidentDate ? formatDate(form.incidentDate) : "" },
        { label: "Claim amount", value: form.amount ? formatINR(Number(form.amount)) : "" },
        { label: "Location", value: form.location },
        { label: "Description", value: form.description },
      ]}
    />
  );
}

function ExtractionSummary({ files, prefilledFields }) {
  const extracted = files.filter(
    (f) => f.extractionStatus === "extracted" && f.extractedData
  );

  if (extracted.length === 0) {
    return null;
  }

  const prefilledEntries = Object.entries(prefilledFields || {});

  return (
    <div className="extraction-summary">
      <div className="section-label">
        <strong>Document extraction summary</strong>
        <span className="count-pill">{extracted.length}</span>
      </div>

      {prefilledEntries.length > 0 && (
        <Callout tone="success">
          <strong>Pre-filled from extraction.</strong>
          <p className="small">
            {"These form fields were auto-filled from uploaded documents and are editable in the Claim details step: "}
            {prefilledEntries.map(([field, file], i, arr) => (
              <span key={field}>
                {FIELD_LABELS[field] || field}
                <span className="muted"> (from {file})</span>
                {i < arr.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </Callout>
      )}

      {extracted.map((entry, idx) => {
        const data = entry.extractedData;
        const missing = Array.isArray(data.missingFields) ? data.missingFields : [];
        const uncertain = Array.isArray(data.uncertainFields) ? data.uncertainFields : [];
        const filled = entry.extractedFields || [];

        return (
          <div key={`${entry.id}-${idx}`} className="extraction-item">
            <div className="extraction-item-header">
              <Icon name="file" size={16} />
              <strong title={entry.file.name}>{entry.file.name}</strong>
              {data.documentType && (
                <span className="badge badge-neutral">{data.documentType.replace(/_/g, " ")}</span>
              )}
            </div>

            {filled.length > 0 && (
              <p className="small">
                <span className="muted">Pre-filled fields:</span>{" "}
                {filled.map((f) => FIELD_LABELS[f] || f).join(", ")}
              </p>
            )}

            {(missing.length > 0 || uncertain.length > 0) && (
              <div className="extraction-gaps small">
                {missing.length > 0 && (
                  <p className="muted">
                    Missing: {missing.map((f) => EXTRACTED_FIELD_LABELS[f] || f).join(", ")}
                  </p>
                )}
                {uncertain.length > 0 && (
                  <p className="muted">
                    Uncertain: {uncertain.map((f) => EXTRACTED_FIELD_LABELS[f] || f).join(", ")}
                  </p>
                )}
              </div>
            )}

            {filled.length === 0 && missing.length === 0 && uncertain.length === 0 && (
              <p className="muted small">No fields were extracted from this document.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ReviewStep({ draft, onBack, onEdit, onSubmit }) {
  const { form, errors, files, submitError, prefilledFields } = draft;
  const missing = FIELD_ORDER.filter((name) => errors[name]);
  const noFiles = files.length === 0;
  const stillUploading = files.some(
    (f) => f.status === "uploading" || f.extractionStatus === "extracting"
  );
  const hasFailed = files.some((f) => f.status === "error");
  const blocked = missing.length > 0 || noFiles || stillUploading;

  return (
    <Card
      title="Review before submitting"
      icon="checkCircle"
      description="Confirm everything below. Documents are already uploaded — review extracted fields and run screening."
    >
      {blocked && (
        <Callout tone="warning">
          <strong>Cannot submit yet</strong>
          <ul className="plain-list">
            {missing.map((name) => (
              <li key={name}>
                {FIELD_LABELS[name]}: {errors[name]}{" "}
                <button type="button" className="link-button" onClick={() => onEdit(1)}>Fix</button>
              </li>
            ))}
            {noFiles && (
              <li>
                No supporting documents added.{" "}
                <button type="button" className="link-button" onClick={() => onEdit(1)}>Add documents</button>
              </li>
            )}
            {stillUploading && (
              <li>
                Some documents are still uploading or extracting.{" "}
                <button type="button" className="link-button" onClick={() => onEdit(1)}>View documents</button>
              </li>
            )}
          </ul>
        </Callout>
      )}

      <div className="review-grid">
        <div>
          <div className="section-label"><strong>Claim details</strong>
            <button type="button" className="link-button" onClick={() => onEdit(1)}>Edit</button>
          </div>
          <ClaimSummary form={form} />
        </div>
        <div>
          <div className="section-label"><strong>Documents</strong><span className="count-pill">{files.length}</span>
            <button type="button" className="link-button" onClick={() => onEdit(1)}>Edit</button>
          </div>
          {files.length ? <FileList files={files} /> : <p className="muted">No documents added yet.</p>}
        </div>
      </div>

      <ExtractionSummary files={files} prefilledFields={prefilledFields} />

      <Callout tone="info">
        On submit, all screening checks run: policy validation, duplicate detection, amount outlier, image forensics, and evidence relevance. The duplicate check also <strong>registers this claim</strong> for future comparisons.
      </Callout>

      {submitError && <div className="stack-sm"><Callout tone="danger">{submitError}</Callout></div>}

      <div className="form-footer">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={blocked}>
          <Icon name="arrowLeft" size={17} /> Back to documents
        </button>
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={blocked}>
          {hasFailed ? "Retry & screen claim" : "Screen claim"} <Icon name="arrow" size={17} />
        </button>
      </div>
    </Card>
  );
}
