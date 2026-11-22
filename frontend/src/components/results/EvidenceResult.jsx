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
  if (tone === "success") return "px-2 py-1 rounded-full text-xs font-bold bg-emerald-900/30 text-emerald-400 border border-emerald-800/30";
  if (tone === "warning") return "px-2 py-1 rounded-full text-xs font-bold bg-amber-900/30 text-amber-400 border border-amber-800/30";
  return "px-2 py-1 rounded-full text-xs font-bold bg-purple-900/30 text-purple-400 border border-purple-800/30";
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
        <strong className="font-semibold text-purple-100">No evidence to validate.</strong>
        <p className="text-purple-200">{result.label || "No uploaded evidence was available for relevance validation."}</p>
      </Callout>
    );
  }

  const items = result.evidenceResults || [];

  if (items.length === 0) {
    return (
      <Callout tone="info">
        <strong className="font-semibold text-purple-100">No evidence results returned.</strong>
        <p className="text-purple-200">The evidence-relevance service did not return any item-level assessments.</p>
      </Callout>
    );
  }

  return (
    <div className="space-y-6">
      <div>
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
          <strong className="font-semibold text-amber-100">Evidence relevance review required.</strong>
          <p className="text-amber-200">At least one uploaded item does not clearly support the reported claim type or incident narrative. A human adjuster should inspect the flagged items before any decision is made.</p>
        </Callout>
      )}

      <div className="space-y-4">
        {items.map((item, idx) => {
          const verdict = item.verdict || "UNCERTAIN";
          const isError = item.status === "ERROR";
          const reasons = Array.isArray(item.reasons) ? item.reasons : [];
          const tone = VERDICT_TONE[verdict] || "neutral";
          const bgColor = tone === "success" ? "bg-emerald-950/20" : tone === "warning" ? "bg-amber-950/20" : "bg-purple-950/20";
          const borderColor = tone === "success" ? "border-emerald-800/30" : tone === "warning" ? "border-amber-800/30" : "border-purple-800/30";

          return (
            <div key={`${item.key}-${idx}`} className={`border ${borderColor} rounded-xl p-4 ${bgColor} space-y-3`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Icon name={item.evidenceType === "document" ? "file" : "image"} size={18} className="text-purple-400 flex-shrink-0" />
                <strong className="text-sm font-semibold text-white truncate flex-1" title={item.fileName}>{item.fileName}</strong>
                <span className={verdictBadgeClass(verdict)}>
                  {isError ? "Failed" : VERDICT_LABEL[verdict] || verdict}
                </span>
              </div>

              {item.detectedContent && (
                <p className="text-sm text-purple-200">
                  <span className="text-xs text-purple-400">Detected content:</span> {item.detectedContent}
                </p>
              )}

              {item.relevanceExplanation && (
                <p className="text-sm text-purple-100 leading-relaxed">{item.relevanceExplanation}</p>
              )}

              {reasons.length > 0 && (
                <ul className="space-y-1 pl-4 text-sm text-purple-200 list-disc list-inside">
                  {reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}

              <div className="text-xs text-purple-400">
                Confidence: {confidenceLabel(item.confidenceScore)}
                {item.evidenceType && ` · ${item.evidenceType}`}
              </div>
            </div>
          );
        })}
      </div>

      {result.disclaimer && (
        <p className="text-xs text-purple-400 leading-relaxed">{result.disclaimer}</p>
      )}
    </div>
  );
}
