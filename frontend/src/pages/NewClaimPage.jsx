import Icon from "../components/Icon";
import Stepper from "../components/Stepper";
import { Callout, Card, PageHeader } from "../components/ui";
import ClaimDetailsStep from "../components/wizard/ClaimDetailsStep";
import DocumentsStep from "../components/wizard/DocumentsStep";
import ReviewStep, { ClaimSummary } from "../components/wizard/ReviewStep";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER } from "../lib/screening";
import { validateClaim } from "../lib/validation";

export default function NewClaimPage({ draft, onScreeningReady, navigate }) {
  const { step, setStep, form, files, setAttempted, entryMode, setEntryMode } = draft;

  function submit() {
    draft.submit((payload) => {
      onScreeningReady(payload);
      navigate(`/results/${encodeURIComponent(payload.claimId)}`);
    });
  }

  // Combined "Review claim" handler for the merged step 1.
  // Validates the form and checks for at least one document.
  function handleReviewClaim() {
    setAttempted(true);
    const formErrors = validateClaim(form);
    if (Object.keys(formErrors).length > 0) {
      // Focus the first invalid field
      const firstInvalid = Object.keys(formErrors)[0];
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    if (files.length === 0) {
      // Scroll to the documents section so the user sees the upload area
      document.getElementById("documents-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setStep(2);
  }

  return (
    <>
      <PageHeader
        eyebrow="CLAIMS WORKSPACE"
        title={step === 2 ? "Review your claim" : "Submit a new claim"}
        description={step === 2
          ? "Confirm the claim details and documents before running the configured screening checks."
          : entryMode === "upload"
            ? "Start with a document, then review the details we extracted before screening."
            : entryMode === "manual"
              ? "Enter the claim details, add supporting documents, and review everything before screening."
              : "Choose the way you want to start. Both paths lead to the same review and screening."}
        actions={entryMode && step === 1 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEntryMode(null)}>
            Change start method
          </button>
        )}
      />

      {!entryMode && step === 1 ? (
        <section className="start-method" aria-labelledby="start-method-title">
          <div className="start-method-heading">
            <span className="eyebrow">CHOOSE YOUR INTAKE</span>
            <h2 id="start-method-title">How would you like to start?</h2>
            <p>Upload a document for extraction, or enter the details yourself. You can review and edit everything before screening.</p>
          </div>
          <div className="entry-choice-grid">
            <button type="button" className="entry-choice entry-choice-upload" onClick={() => setEntryMode("upload")}>
              <span className="entry-choice-icon"><Icon name="cloud" size={23} /></span>
              <span className="entry-choice-content">
                <strong>Upload a claim document</strong>
                <span>Start with a PDF or image. We’ll extract details for you to review.</span>
                <span className="entry-choice-link">Start with a document <Icon name="arrow" size={16} /></span>
              </span>
            </button>
            <button type="button" className="entry-choice" onClick={() => setEntryMode("manual")}>
              <span className="entry-choice-icon"><Icon name="file" size={23} /></span>
              <span className="entry-choice-content">
                <strong>Enter details manually</strong>
                <span>Fill in the claim information, then attach supporting documents.</span>
                <span className="entry-choice-link">Enter claim details <Icon name="arrow" size={16} /></span>
              </span>
            </button>
          </div>
        </section>
      ) : (
        <>
          <Stepper current={step} onStepClick={setStep} />
          <div className="wizard-grid">
            <div className="wizard-main">
              {step === 1 && (
                <>
                  {entryMode === "upload" ? (
                    <>
                      <div id="documents-section">
                        <DocumentsStep draft={draft} hideFooter />
                      </div>
                      <ClaimDetailsStep draft={draft} entryMode={entryMode} hideFooter />
                    </>
                  ) : (
                    <>
                      <ClaimDetailsStep draft={draft} entryMode={entryMode} hideFooter />
                      <div id="documents-section">
                        <DocumentsStep draft={draft} hideFooter />
                      </div>
                    </>
                  )}

                  <div className="combined-footer">
                    <Callout tone="info">
                      <strong>Ready to screen?</strong>
                      <p className="small">
                        Add claim details and at least one supporting document. Extraction only fills empty fields; review all details before screening.
                      </p>
                    </Callout>

                    <div className="form-footer">
                      <span className="muted small">
                        {files.length === 0
                          ? "No documents attached yet."
                          : `${files.length} document${files.length === 1 ? "" : "s"} attached.`}
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleReviewClaim}
                      >
                        Review claim <Icon name="arrow" size={17} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {step === 2 && <ReviewStep draft={draft} onBack={() => setStep(1)} onEdit={setStep} onSubmit={submit} />}
            </div>

            <aside className="wizard-side" aria-label="Claim summary and checks">
              {step > 1 && (
                <Card title="Claim summary" icon="file">
                  <ClaimSummary form={draft.form} />
                </Card>
              )}
              <Card title="Checks that will run" icon="shield">
                <ul className="check-preview">
                  {CHECK_ORDER.map((key) => (
                    <li key={key}><Icon name={CHECKS[key].icon} size={17} /><span>{CHECKS[key].title}</span></li>
                  ))}
                </ul>
                <p className="muted small">
                  Six checks run independently across claim details and uploaded evidence.
                  Findings are indicators for human review, never a fraud determination.
                </p>
              </Card>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
