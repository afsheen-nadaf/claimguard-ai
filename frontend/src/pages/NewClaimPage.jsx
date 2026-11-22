import toast from "react-hot-toast";
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
      toast.success("Claim submitted! Your claim is now being processed.");
      onScreeningReady(payload);
      navigate("/history");
    });
  }

  function handleContinueToPhotos() {
    setAttempted(true);
    const formErrors = validateClaim(form);
    if (Object.keys(formErrors).length > 0) {
      const firstInvalid = Object.keys(formErrors)[0];
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setStep(2);
  }

  return (
    <>
      <PageHeader
        eyebrow="CLAIMS WORKSPACE"
        title={
          step === 3
            ? "Review your claim"
            : step === 2
              ? "Add claim photos"
              : "Submit a new claim"
        }
        description={
          step === 3
            ? "Confirm the claim details and evidence before submitting your claim."
            : step === 2
              ? "Upload up to two photos, or continue without photos if none apply."
              : entryMode === "upload"
                ? "Start with a PDF, then review the details we extract and fill any gaps."
                : entryMode === "manual"
                  ? "Enter claim details and add any supporting PDF documents before uploading photos."
                  : "Choose whether to start by uploading a PDF or entering claim details."
        }
        actions={entryMode && step === 1 && (
          <button
            type="button"
            className="px-3 py-2 bg-[#251d33] text-purple-200 border border-purple-700/30 rounded-lg text-sm font-semibold hover:bg-[#2d2440] hover:border-purple-600/50 transition-all"
            onClick={() => setEntryMode(null)}
          >
            Change start method
          </button>
        )}
      />

      {!entryMode && step === 1 ? (
        <section
          className="max-w-[1040px] mx-auto p-10 border border-purple-700/30 rounded-2xl bg-gradient-to-br from-[#1a1425] to-[#251d33] shadow-2xl"
          aria-labelledby="start-method-title"
        >
          <div className="max-w-[620px] mb-8">
            <span className="text-[11px] font-bold tracking-wider text-purple-400 uppercase block mb-2">Choose Your Intake</span>
            <h2 id="start-method-title" className="text-3xl font-bold text-white tracking-tight mb-3">
              How would you like to start?
            </h2>
            <p className="text-purple-200">
              Upload a document for extraction, or enter the details yourself. You can review and edit everything before submitting.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload Choice */}
            <button
              type="button"
              className="grid grid-cols-[46px,1fr] items-start gap-4 p-6 border border-purple-600/40 rounded-xl bg-gradient-to-br from-[#251d33] to-[#1a1425] text-left hover:-translate-y-1 hover:border-purple-500/60 hover:shadow-xl hover:shadow-purple-900/20 transition-all min-h-[174px]"
              onClick={() => setEntryMode("upload")}
            >
              <span className="w-11 h-11 flex items-center justify-center rounded-xl bg-purple-900/30 text-purple-400 border border-purple-700/30">
                <Icon name="cloud" size={23} />
              </span>
              <span className="flex flex-col gap-2">
                <strong className="text-[15px] font-bold text-white tracking-tight">Upload a claim document</strong>
                <span className="text-sm text-purple-200 leading-relaxed">
                  Start with a PDF. We'll extract details for you to review.
                </span>
                <span className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-purple-400">
                  Start with a document <Icon name="arrow" size={16} />
                </span>
              </span>
            </button>

            {/* Manual Entry Choice */}
            <button
              type="button"
              className="grid grid-cols-[46px,1fr] items-start gap-4 p-6 border border-purple-700/40 rounded-xl bg-gradient-to-br from-[#1a1425] to-[#251d33] text-left hover:-translate-y-1 hover:border-purple-600/60 hover:shadow-xl hover:shadow-purple-900/20 transition-all min-h-[174px]"
              onClick={() => setEntryMode("manual")}
            >
              <span className="w-11 h-11 flex items-center justify-center rounded-xl bg-purple-900/30 text-purple-400 border border-purple-700/30">
                <Icon name="file" size={23} />
              </span>
              <span className="flex flex-col gap-2">
                <strong className="text-[15px] font-bold text-white tracking-tight">Enter details manually</strong>
                <span className="text-sm text-purple-200 leading-relaxed">
                  Fill in the claim information, then attach supporting documents.
                </span>
                <span className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-purple-400">
                  Enter claim details <Icon name="arrow" size={16} />
                </span>
              </span>
            </button>
          </div>
        </section>
      ) : (
        <>
          <Stepper current={step} onStepClick={setStep} />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),320px] gap-6 items-start">
            <div className="min-w-0 space-y-6">
              {step === 1 && (
                <>
                  {entryMode === "upload" ? (
                    <>
                      <div id="documents-section">
                        <DocumentsStep draft={draft} mode="documents" hideFooter />
                      </div>
                      <ClaimDetailsStep draft={draft} entryMode={entryMode} hideFooter />
                    </>
                  ) : (
                    <>
                      <ClaimDetailsStep draft={draft} entryMode={entryMode} hideFooter />
                      <div id="documents-section">
                        <DocumentsStep draft={draft} mode="documents" hideFooter />
                      </div>
                    </>
                  )}

                  <div className="space-y-4">
                    <Callout tone="info">
                      <strong className="font-semibold text-purple-100">Ready to continue?</strong>
                      <p className="text-sm text-purple-200 mt-1">
                        Add claim details and any supporting PDFs. You can add photos next; at least one supporting PDF or photo is required before submitting.
                      </p>
                    </Callout>

                    <div className="flex items-center justify-between gap-4 pt-5 border-t border-purple-800/30 flex-wrap">
                      <span className="text-sm text-purple-300">
                        {files.length === 0
                          ? "No documents attached yet."
                          : `${files.length} document${files.length === 1 ? "" : "s"} attached.`}
                      </span>
                      <button
                        type="button"
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-500 hover:to-purple-600 transition-all shadow-lg shadow-purple-900/30 inline-flex items-center gap-2"
                        onClick={handleContinueToPhotos}
                      >
                        Continue to photos <Icon name="arrow" size={17} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <DocumentsStep draft={draft} mode="images" hideFooter />
                  <div className="flex items-center justify-between gap-4 pt-5 border-t border-purple-800/30 flex-wrap">
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-[#251d33] text-purple-100 border border-purple-700/30 rounded-xl font-semibold hover:bg-[#2d2440] transition-all inline-flex items-center gap-2"
                      onClick={() => setStep(1)}
                    >
                      <Icon name="arrowLeft" size={17} /> Back to details
                    </button>
                    <button
                      type="button"
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-500 hover:to-purple-600 transition-all shadow-lg shadow-purple-900/30 inline-flex items-center gap-2"
                      onClick={() => setStep(3)}
                    >
                      Continue to review <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </>
              )}
              {step === 3 && (
                <ReviewStep draft={draft} onBack={() => setStep(2)} onEdit={setStep} onSubmit={submit} />
              )}
            </div>

            <aside className="space-y-6 lg:sticky lg:top-24" aria-label="Claim summary and checks">
              {step > 1 && (
                <Card title="Claim Summary" icon="file">
                  <ClaimSummary form={draft.form} />
                </Card>
              )}
              <Card title="Checks that will run" icon="shield">
                <ul className="space-y-3 mb-4">
                  {CHECK_ORDER.map((key) => (
                    <li key={key} className="flex items-center gap-3 font-medium text-purple-200">
                      <Icon name={CHECKS[key].icon} size={17} className="text-purple-400 flex-shrink-0" />
                      <span>{CHECKS[key].title}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-purple-400 leading-relaxed">
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