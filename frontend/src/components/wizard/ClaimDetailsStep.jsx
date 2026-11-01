import { CLAIM_TYPES } from "../../api/config";
import { FIELD_ORDER, validateField } from "../../lib/validation";
import { formatINR, todayISO } from "../../lib/format";
import Icon from "../Icon";
import { Card } from "../ui";

function Field({ id, label, required = true, error, hint, children, className = "" }) {
  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`}>
      <label htmlFor={id}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`}><Icon name="alert" size={14} />{error}</p>}
    </div>
  );
}

export default function ClaimDetailsStep({ draft, onContinue }) {
  const { form, setField, touched, touch, attempted, setAttempted } = draft;
  const visibleError = (name) => (touched[name] || attempted ? validateField(name, form) : null);
  const describe = (name, hasHint) => (visibleError(name) ? `${name}-error` : hasHint ? `${name}-hint` : undefined);
  const common = (name, hasHint = false) => ({
    id: name,
    "aria-invalid": visibleError(name) ? "true" : undefined,
    "aria-describedby": describe(name, hasHint),
    onBlur: () => touch(name),
  });

  function handleContinue() {
    setAttempted(true);
    const firstInvalid = FIELD_ORDER.find((name) => validateField(name, form));
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    onContinue();
  }

  const amountPreview = !validateField("amount", form) ? formatINR(Number(form.amount)) : null;

  return (
    <Card
      title="Claim information"
      icon="file"
      description="These details are what the screening checks run on. Double-check the policy number and amount."
    >
      <form
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
      >
        <Field id="claimType" label="Claim type" error={visibleError("claimType")}>
          <select {...common("claimType")} value={form.claimType} onChange={(e) => setField("claimType", e.target.value)}>
            <option value="">Select claim type</option>
            {CLAIM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field id="policyNumber" label="Policy number" error={visibleError("policyNumber")}>
          <input
            {...common("policyNumber")}
            value={form.policyNumber}
            onChange={(e) => setField("policyNumber", e.target.value)}
            placeholder="e.g. POL-2024-001234"
            maxLength={80}
            autoComplete="off"
          />
        </Field>

        <Field id="incidentDate" label="Incident date" error={visibleError("incidentDate")}>
          <input
            {...common("incidentDate")}
            type="date"
            max={todayISO()}
            value={form.incidentDate}
            onChange={(e) => setField("incidentDate", e.target.value)}
          />
        </Field>

        <Field
          id="amount"
          label="Claim amount (INR)"
          error={visibleError("amount")}
          hint={amountPreview ? `Reads as ${amountPreview}` : "Up to 2 decimal places"}
        >
          <div className="input-affix">
            <span aria-hidden="true">₹</span>
            <input
              {...common("amount", true)}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="e.g. 125000"
            />
          </div>
        </Field>

        <Field id="location" label="Incident location" className="span-2" error={visibleError("location")}>
          <input
            {...common("location")}
            value={form.location}
            onChange={(e) => setField("location", e.target.value)}
            placeholder="City, state or incident location"
            maxLength={200}
          />
        </Field>

        <Field id="description" label="Incident description" className="span-2" error={visibleError("description")}>
          <textarea
            {...common("description")}
            rows={5}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Describe what happened, including relevant dates and circumstances…"
            maxLength={1000}
          />
          <span className="char-count" aria-live="off">{form.description.length}/1000</span>
        </Field>

        <div className="form-footer span-2">
          <span className="required-note"><span className="req">*</span> Required</span>
          <button type="submit" className="btn btn-primary">
            Continue to documents <Icon name="arrow" size={17} />
          </button>
        </div>
      </form>
    </Card>
  );
}
