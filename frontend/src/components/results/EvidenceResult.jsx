import Icon from "../Icon";
import { Callout, KeyValueList } from "../ui";
import { toNumber } from "../../lib/format";

const VERDICT_LABEL = {
  RELEVANT: "Relevant",
  POTENTIAL_MISMATCH: "Potential mismatch",
  UNCERTAIN: "Uncertain",
};

const VERDICT_TONE = {
  RELEVANT: "success",
  POTENTIAL_MISMATCH: "warning",
  UNCERTAIN: "neutral",
};

function verdictBadgeClass(verdict) {
  const tone = VERDICT_TONE[verdict] || "neutral";
  return `badge badge-${tone}`;
}

function confidenceLabel(score) {
  const n = toNumber(score);
  if (n === null) return "—";
  const pct = Math.round(n * 100);
  if (pct >= 80) return `${pct}% (high)`;
  if (pct >= 50) return `${pct}% (moderate)`;
  return `${pct}% (low)`;
}

export default function EvidenceResult({ result }) {
  if (!result) return null;

  if (result.skipped) {
    return (
      <Callout tone="info">
        <strong>No evidence to validate.</strong>
        <p>{result.label || "No uploaded evidence was available for relevance validation."}</p>
      </Callout>
    );
  }

  const items = result.evidenceResults || [];

  if (items.length === 0) {
    return (
      <Callout tone="info">
        <strong>No evidence results returned.</strong>
        <p>The evidence-relevance service did not return any item-level assessments.</p>
      </Callout>
    );
  }

  return (
    <div className="stack-sm">
      <div className="evidence-summary">
        <KeyValueList
          items={[
            { label: "Overall verdict", value: VERDICT_LABEL[result.overallVerdict] || result.overallVerdict || "—" },
            { label: "Items assessed", value: items.length },
            { label: "Relevant", value: result.relevantCount ?? 0 },
            { label: "Mismatches", value: result.mismatches?.length ?? 0 },
            { label: "Inconclusive / failed", value: result.uncertainCount ?? 0 },
            { label: "Requires review", value: result.requiresReview ? "Yes" : "No" },
          ]}
        />
      </div>

      {result.requiresReview && (
        <Callout tone="warning">
          <strong>Evidence relevance review required.</strong>
          <p>At least one uploaded item does not clearly support the reported claim type or incident narrative. A human adjuster should inspect the flagged items before any decision is made.</p>
        </Callout>
      )}

      <div className="evidence-items">
        {items.map((item, idx) => {
          const verdict = item.verdict || "UNCERTAIN";
          const isError = item.status === "ERROR";
          const reasons = Array.isArray(item.reasons) ? item.reasons : [];

          return (
            <div key={`${item.key}-${idx}`} className={`evidence-item tone-${VERDICT_TONE[verdict] || "neutral"}`}>
              <div className="evidence-item-header">
                <Icon name={item.evidenceType === "document" ? "file" : "image"} size={18} />
                <strong title={item.fileName}>{item.fileName}</strong>
                <span className={verdictBadgeClass(verdict)}>
                  {isError ? "Failed" : VERDICT_LABEL[verdict] || verdict}
                </span>
              </div>

              {item.detectedContent && (
                <p className="evidence-detected">
                  <span className="muted small">Detected content:</span> {item.detectedContent}
                </p>
              )}

              {item.relevanceExplanation && (
                <p className="evidence-explanation">{item.relevanceExplanation}</p>
              )}

              {reasons.length > 0 && (
                <ul className="evidence-reasons plain-list">
                  {reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}

              <div className="evidence-meta small muted">
                Confidence: {confidenceLabel(item.confidenceScore)}
                {item.evidenceType && ` · ${item.evidenceType}`}
              </div>
            </div>
          );
        })}
      </div>

      {result.disclaimer && (
        <p className="muted small">{result.disclaimer}</p>
      )}
    </div>
  );
}
