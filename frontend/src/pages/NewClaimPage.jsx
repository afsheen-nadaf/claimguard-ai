import Icon from "../components/Icon";
import Stepper from "../components/Stepper";
import { Card, PageHeader } from "../components/ui";
import ClaimDetailsStep from "../components/wizard/ClaimDetailsStep";
import DocumentsStep from "../components/wizard/DocumentsStep";
import ReviewStep, { ClaimSummary } from "../components/wizard/ReviewStep";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER } from "../lib/screening";

export default function NewClaimPage({ draft, onScreeningReady, navigate }) {
  const { step, setStep } = draft;

  function submit() {
    draft.submit((payload) => {
      onScreeningReady(payload);
      navigate(`/results/${encodeURIComponent(payload.claimId)}`);
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="CLAIMS WORKSPACE"
        title={step === 3 ? "Review your claim" : "Submit a new claim"}
        description="Enter the claim, attach supporting documents, and run the configured screening checks. Results are indicators for a human reviewer."
      />
      <Stepper current={step} onStepClick={setStep} />

      <div className="wizard-grid">
        <div className="wizard-main">
          {step === 1 && <ClaimDetailsStep draft={draft} onContinue={() => setStep(2)} />}
          {step === 2 && <DocumentsStep draft={draft} onBack={() => setStep(1)} onContinue={() => setStep(3)} />}
          {step === 3 && <ReviewStep draft={draft} onBack={() => setStep(2)} onEdit={setStep} onSubmit={submit} />}
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
  Policy validation and claim-amount outlier detection use
  structured claim details. Duplicate-claim detection also
  compares uploaded images against previously submitted
  claims when image fingerprints are available.
  All findings are indicators for human review.
</p>

          </Card>
        </aside>
      </div>
    </>
  );
}
