import Icon from "../Icon";
import { Callout, Card, KeyValueList, Spinner } from "../ui";
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

export default function ReviewStep({ draft, onBack, onEdit, onSubmit }) {
  const { form, errors, files, isSubmitting, submitError } = draft;
  const missing = FIELD_ORDER.filter((name) => errors[name]);
  const noFiles = files.length === 0;
  const blocked = missing.length > 0 || noFiles;
  const hasFailed = files.some((f) => f.status === "error");

  return (
    <Card
      title="Review before submitting"
      icon="checkCircle"
      description="Confirm everything below. You can go back to any step without losing your entries."
    >
      {blocked && (
        <Callout tone="warning">
          <strong>Missing or invalid information</strong>
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
                <button type="button" className="link-button" onClick={() => onEdit(2)}>Add documents</button>
              </li>
            )}
          </ul>
        </Callout>
      )}

      <div className="review-grid">
        <div>
          <div className="section-label"><strong>Claim details</strong>
            <button type="button" className="link-button" onClick={() => onEdit(1)} disabled={isSubmitting}>Edit</button>
          </div>
          <ClaimSummary form={form} />
        </div>
        <div>
          <div className="section-label"><strong>Documents</strong><span className="count-pill">{files.length}</span>
            <button type="button" className="link-button" onClick={() => onEdit(2)} disabled={isSubmitting}>Edit</button>
          </div>
          {files.length ? <FileList files={files} /> : <p className="muted">No documents added yet.</p>}
        </div>
      </div>

      <Callout tone="info">
        On submit, documents upload first. Only if every upload succeeds, the policy, duplicate and amount checks run. The duplicate check also <strong>registers this claim</strong> for future comparisons.
      </Callout>

      {submitError && <div className="stack-sm"><Callout tone="danger">{submitError}</Callout></div>}

      <div className="form-footer">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={isSubmitting}>
          <Icon name="arrowLeft" size={17} /> Back to documents
        </button>
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={isSubmitting || blocked}>
          {isSubmitting ? (
            <Spinner label="Uploading documents…" />
          ) : (
            <>{hasFailed ? "Retry failed uploads & screen" : "Upload & screen claim"} <Icon name="arrow" size={17} /></>
          )}
        </button>
      </div>
    </Card>
  );
}
