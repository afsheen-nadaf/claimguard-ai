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
  CROSS_EVIDENCE_PHOTO_MISMATCH: "warning",
};

export default function ConsistencyResult({ result, status }) {
  if (!result) {
    const message = status === "error"
      ? "The consistency check failed before it could return a result."
      : "Document & image consistency is still running.";
    return (
      <Callout tone={status === "error" ? "danger" : "info"}>
        <strong className="font-semibold text-purple-100">{message}</strong>
      </Callout>
    );
  }

  const evidenceComparison = result.evidenceComparison || null;
  const hasPhotoComparison = Boolean(
    evidenceComparison && ["CONSISTENT", "REVIEW"].includes(evidenceComparison.status)
  );
  const docsAnalyzed = result.documentsAnalyzed || 0;
  const totalFiles = result.totalFiles ?? result.totalDocuments;
  const photosDetected = result.photosDetected;
  const isPipelinePlaceholder = result.skipReason === "Not run in background pipeline";

  const isSkipped =
    result.kind === "skipped" ||
    result.status === "SKIPPED" ||
    result.state === "skipped";

  if (isSkipped) {
    return (
      <Callout tone="info">
        <strong className="font-semibold text-purple-100">
          Document & image consistency skipped.
        </strong>
        <p className="text-purple-200">
          {result.skipReason || result.message || "There was not enough eligible evidence to compare."}
        </p>
        {(totalFiles !== undefined || photosDetected !== undefined) && (
          <p className="text-sm text-purple-300">
            {totalFiles !== undefined && `${totalFiles} file${totalFiles === 1 ? "" : "s"} uploaded`}
            {totalFiles !== undefined && photosDetected !== undefined && "; "}
            {photosDetected !== undefined && `${photosDetected} photo${photosDetected === 1 ? "" : "s"} detected`}
            {`; ${docsAnalyzed} document${docsAnalyzed === 1 ? "" : "s"} with extracted data`}
          </p>
        )}
        {!isPipelinePlaceholder && (
          <p className="text-sm text-purple-300">
            Upload at least two documents with extractable data or two or more photos to compare documents and images.
          </p>
        )}
      </Callout>
    );
  }

  const flags = result.flags || [];
  const summary = result.summary;
  const isIncomplete =
    result.state === "inconclusive" ||
    result.status === "INCONCLUSIVE" ||
    result.status === "ERROR" ||
    evidenceComparison?.status === "ERROR";

  return (
    <div className="space-y-6">
      <KeyValueList
        items={[
          { label: "Files uploaded", value: totalFiles ?? "—" },
          { label: "Documents with extracted data", value: docsAnalyzed },
          { label: "Photos detected", value: photosDetected ?? "—" },
          { label: "Comparable fields checked", value: summary?.comparableFieldsChecked || 0 },
          ...(hasPhotoComparison
            ? [{ label: "Photos compared", value: evidenceComparison.photosCompared || 0 }]
            : []),
          { label: "Inconsistencies found", value: flags.length },
        ]}
      />

      {isIncomplete && (
        <Callout tone="warning">
          <strong className="font-semibold text-amber-100">Document & image consistency check incomplete.</strong>
          <p className="text-sm text-amber-200">
            {result.message ||
              evidenceComparison?.summary ||
              "Some consistency comparisons could not be completed."}
          </p>
        </Callout>
      )}

      {flags.length === 0 ? (
        <Callout tone={isIncomplete ? "warning" : "success"}>
          <strong className={isIncomplete ? "font-semibold text-amber-100" : "font-semibold text-emerald-100"}>
            {isIncomplete ? "No mismatch was found in the completed comparisons." : "No consistency issues detected."}
          </strong>
          <p className={isIncomplete ? "text-sm text-amber-200" : "text-sm text-emerald-200"}>
            {isIncomplete
              ? "A full comparison was not completed, so this result is not a consistency pass."
              : result.message ||
                "Comparable document fields and uploaded evidence photos appear consistent within this submission."}
          </p>
        </Callout>
      ) : (
        <Callout tone="warning">
          <strong className="font-semibold text-amber-100">
            {flags.length} inconsistency{flags.length === 1 ? "" : "ies"} detected.
          </strong>
          <p className="text-sm text-amber-200">
            Discrepancies were observed across documents or uploaded photos. An analyst should
            inspect the items below before making any decision; differences can stem from extraction
            errors, camera angles, or lighting.
          </p>
        </Callout>
      )}

      {hasPhotoComparison && (
        <div className="border border-purple-700/40 rounded-xl p-4 bg-purple-950/30 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="image" size={18} className="text-purple-300" />
            <strong className="text-sm font-semibold text-purple-100">
              Cross-Evidence Photo Comparison
            </strong>
            <span className="ml-auto text-xs font-mono bg-black/25 px-2 py-0.5 rounded border border-white/10 text-purple-200">
              {evidenceComparison.verdict || evidenceComparison.status}
            </span>
          </div>
          <p className="text-sm text-purple-200">{evidenceComparison.summary}</p>
          {Array.isArray(evidenceComparison.observations) &&
            evidenceComparison.observations.length > 0 && (
              <ul className="space-y-2 pt-1">
                {evidenceComparison.observations.map((obs, i) => (
                  <li key={`${obs.fileName}-${i}`} className="text-xs text-purple-200">
                    <strong className="text-white">{obs.fileName}</strong>
                    {obs.verdict ? ` (${obs.verdict})` : ""}: {obs.detail}
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}

      {flags.length > 0 && (
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
      )}

      <p className="text-xs text-purple-400 leading-relaxed">
        Document and image comparisons are screening signals for adjuster review, not
        proof of fraud.
      </p>
    </div>
  );
}