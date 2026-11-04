import Icon from "../Icon";
import { Callout, Card, Spinner, StatusBadge } from "../ui";

export default function RelevanceResult({ check, onRetry }) {
  const result = check?.result || {};
  const isRunning = check?.status === "running";
  const isError = check?.status === "error";
  const isSkipped = Boolean(result.skipped);

  const evidenceResults = Array.isArray(result.evidenceResults) ? result.evidenceResults : [];
  const overallVerdict = result.overallVerdict || "UNCERTAIN";

  return (
    <section className="evidence-relevance-section mt" aria-labelledby="relevance-title">
      <div className="section-head">
        <div>
          <div className="eyebrow">EVIDENCE RELEVANCE</div>
          <h2 id="relevance-title" className="section-title">
            Evidence Relevance Validation
          </h2>
          <p className="muted small">
            Multimodal evaluation using Amazon Bedrock (Nova Lite) to verify whether uploaded photos and PDF documents visually and contextually support the reported claim type and incident narrative.
          </p>
        </div>

        <div className="section-head-actions">
          <StatusBadge
            state={
              isError
                ? "error"
                : isRunning
                ? "idle"
                : isSkipped
                ? "idle"
                : check?.state === "pass"
                ? "pass"
                : check?.state === "review"
                ? "review"
                : "idle"
            }
            label={
              isError
                ? "Validation error"
                : isRunning
                ? "Analyzing evidence…"
                : isSkipped
                ? "Skipped (No files)"
                : overallVerdict === "RELEVANT"
                ? "Relevant"
                : overallVerdict === "POTENTIAL_MISMATCH"
                ? "Potential mismatch"
                : "Review required"
            }
          />
          {isError && onRetry && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRetry}
            >
              <Icon name="refresh" size={14} /> Retry relevance check
            </button>
          )}
        </div>
      </div>

      {isRunning && (
        <Card className="forensics-overview-card">
          <div className="forensics-pipeline-note">
            <Spinner label="" />
            <div>
              <strong>Evaluating evidence relevance with Amazon Bedrock…</strong>
              <p className="muted small">
                Analyzing uploaded damage photos and PDF document line items against the reported incident description.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isError && (
        <Callout tone="danger" icon="alert">
          <strong>Evidence relevance validation could not be completed</strong>
          <p>{check?.error || "The relevance service encountered an unexpected error."}</p>
          {onRetry && (
            <p className="mt">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onRetry}
              >
                <Icon name="refresh" size={14} /> Retry relevance check
              </button>
            </p>
          )}
        </Callout>
      )}

      {isSkipped && !isRunning && !isError && (
        <Card>
          <div className="forensics-pipeline-note">
            <Icon name="info" size={16} />
            <div>
              <strong>No evidence files submitted</strong>
              <p className="muted small">
                {result.message || "This claim has no uploaded images or PDF documents to evaluate."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {!isRunning && !isError && !isSkipped && (
        <>
          {/* Overall Analyst Callout */}
          {overallVerdict === "POTENTIAL_MISMATCH" ? (
            <Callout tone="warning" icon="alert" className="mb">
              <strong>Potential Evidence Mismatch Detected</strong>
              <p>
                One or more uploaded evidence files appear inconsistent with or unrelated to the reported incident description. A claims adjuster must manually verify these items before adjudication.
              </p>
            </Callout>
          ) : overallVerdict === "UNCERTAIN" ? (
            <Callout tone="info" icon="info" className="mb">
              <strong>Evidence Relevance Inconclusive</strong>
              <p>
                The model could not conclusively verify relevance for all evidence items (content may be cropped, unreadable, or missing itemized details). Adjuster inspection is recommended.
              </p>
            </Callout>
          ) : (
            <Callout tone="success" icon="checkCircle" className="mb">
              <strong>All Evidence Consistent with Claim Narrative</strong>
              <p>
                Automated multimodal analysis confirmed that submitted photographs and documents align with the reported claim type and incident details.
              </p>
            </Callout>
          )}

          {/* Per-Evidence Item Cards Grid */}
          <div className="evidence-items-grid">
            {evidenceResults.map((item, idx) => {
              const isMismatch = item.verdict === "POTENTIAL_MISMATCH";
              const isRelevant = item.verdict === "RELEVANT";
              const isItemError = item.status === "ERROR";

              return (
                <div
                  key={`${item.key}-${idx}`}
                  className={`card evidence-item-card ${
                    isMismatch ? "border-warning" : isRelevant ? "border-success" : ""
                  }`}
                >
                  <div className="card-header">
                    <div className="card-icon">
                      <Icon
                        name={item.evidenceType === "document" ? "file" : "image"}
                        size={18}
                      />
                    </div>
                    <div className="card-title-wrap">
                      <h3 className="card-title">{item.fileName}</h3>
                      <div className="evidence-type-tags">
                        <span className="badge badge-neutral badge-sm">
                          {item.evidenceType === "document" ? "Document (PDF)" : "Photo Evidence"}
                        </span>
                        <span className="muted small">
                          {item.confidenceScore > 0 &&
                            `${Math.round(item.confidenceScore * 100)}% confidence estimate`}
                        </span>
                      </div>
                    </div>
                    <StatusBadge
                      state={isItemError ? "error" : isRelevant ? "pass" : "review"}
                      label={
                        isItemError
                          ? "Error"
                          : isRelevant
                          ? "Relevant"
                          : isMismatch
                          ? "Mismatch"
                          : "Uncertain"
                      }
                    />
                  </div>

                  <div className="evidence-item-body">
                    <div className="evidence-detail-block">
                      <span className="mini-label">Detected Content</span>
                      <p className="evidence-text">{item.detectedContent}</p>
                    </div>

                    <div className="evidence-detail-block mt-xs">
                      <span className="mini-label">Relevance Assessment</span>
                      <p className="evidence-text">{item.relevanceExplanation}</p>
                    </div>

                    {Array.isArray(item.reasons) && item.reasons.length > 0 && (
                      <div className="evidence-reasons-block mt-xs">
                        <span className="mini-label">Noted Discrepancies / Reasons</span>
                        <ul className="evidence-reasons-list">
                          {item.reasons.map((r, rIdx) => (
                            <li key={rIdx}>
                              <Icon name="alert" size={14} />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="muted small forensics-disclaimer mt">
            {result.disclaimer ||
              "Evidence relevance screening is an automated heuristic using Amazon Bedrock. Potential mismatches highlight items for human adjuster review; claims are never automatically rejected."}
          </p>
        </>
      )}
    </section>
  );
}
