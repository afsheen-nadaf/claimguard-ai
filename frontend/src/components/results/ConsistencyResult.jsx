import Icon from "../Icon";
import { Callout, KeyValueList } from "../ui";

const FLAG_TONE = {
  DATE_MISMATCH: "warning",
  AMOUNT_MISMATCH: "warning",
  POLICY_NUMBER_MISMATCH: "warning",
  CLAIM_TYPE_MISMATCH: "warning",
  CLAIMANT_MISMATCH: "warning",
  CLAIM_NUMBER_MISMATCH: "warning",
  DUPLICATE_INVOICE: "danger",
};

export default function ConsistencyResult({ result }) {
  if (!result) return null;

  const isSkipped =
    result.kind === "skipped" ||
    result.status === "SKIPPED" ||
    result.state === "skipped" ||
    (result.documentsAnalyzed ?? 0) < 2;

  if (isSkipped) {
    const reasonText =
      result.skipReason ||
      ((result.documentsAnalyzed ?? 0) === 0
        ? "0 documents"
        : `${result.documentsAnalyzed} document`);

    return (
      <Callout tone="info">
        <strong className="font-semibold text-purple-100">
          Cross-document consistency skipped ({reasonText}).
        </strong>
        <p className="text-purple-200">
          {result.message || "Not enough documents with extractable data for cross-document comparison."}
        </p>
        <p className="text-sm text-purple-300">
          Upload at least two documents with extractable data to compare fields across documents.
        </p>
      </Callout>
    );
  }

  const flags = result.flags || [];
  const summary = result.summary;

  if (flags.length === 0) {
    return (
      <div className="space-y-6">
        <KeyValueList
          items={[
            { label: "Documents analyzed", value: result.documentsAnalyzed || 0 },
            { label: "Comparable fields checked", value: summary?.comparableFieldsChecked || 0 },
            { label: "Inconsistencies found", value: 0 },
          ]}
        />
        <Callout tone="success">
          <strong className="font-semibold text-emerald-100">All documents are consistent.</strong>
          <p className="text-sm text-emerald-200">
            Every comparable field (policy number, incident date, claim amount, claim type, claimant name, claim number)
            matches across all uploaded documents. No duplicate invoice numbers were found within this upload set.
          </p>
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KeyValueList
        items={[
          { label: "Documents analyzed", value: result.documentsAnalyzed || 0 },
          { label: "Comparable fields checked", value: summary?.comparableFieldsChecked || 0 },
          { label: "Inconsistencies found", value: flags.length },
        ]}
      />

      <Callout tone="warning">
        <strong className="font-semibold text-amber-100">
          {flags.length} inconsistency{flags.length === 1 ? "" : "ies"} detected.
        </strong>
        <p className="text-sm text-amber-200">
          Fields extracted from different documents do not match. An analyst should compare the
          flagged documents before making any decision. Mismatches may result from extraction errors,
          document versions, or intentional discrepancies.
        </p>
      </Callout>

      <div className="space-y-4">
        {flags.map((flag, idx) => {
          const tone = FLAG_TONE[flag.code] || "warning";
          const entries = Object.entries(flag.values || {});
          const bgColor = tone === "danger" ? "bg-red-950/30" : "bg-amber-950/30";
          const borderColor = tone === "danger" ? "border-red-700/40" : "border-amber-700/40";
          const textColor = tone === "danger" ? "text-red-200" : "text-amber-200";

          return (
            <div
              key={`${flag.code}-${idx}`}
              className={`border ${borderColor} rounded-xl p-4 ${bgColor} space-y-3`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Icon
                  name="alert"
                  size={18}
                  className={tone === "danger" ? "text-red-400" : "text-amber-400"}
                />
                <strong className={`text-sm font-semibold ${textColor}`}>{flag.label}</strong>
                <code className="ml-auto text-xs font-mono bg-black/20 px-2 py-0.5 rounded border border-white/10">
                  {flag.code}
                </code>
              </div>
              <p className={`text-sm ${textColor}`}>{flag.message}</p>
              {entries.length > 0 && (
                <dl className="space-y-2 mt-3">
                  {entries.map(([fileName, value]) => (
                    <div
                      key={fileName}
                      className="grid grid-cols-[minmax(120px,40%),minmax(0,1fr)] gap-3 py-2 border-b border-white/5 last:border-0"
                    >
                      <dt
                        className="text-xs text-purple-400 overflow-hidden text-ellipsis whitespace-nowrap"
                        title={fileName}
                      >
                        {fileName}
                      </dt>
                      <dd className="text-sm font-semibold text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-purple-400 leading-relaxed">
        Cross-document consistency compares fields extracted by Bedrock from each uploaded document.
        Extraction may be imperfect — verify flagged mismatches against the original documents.
        This is a screening signal, not proof of fraud.
      </p>
    </div>
  );
}