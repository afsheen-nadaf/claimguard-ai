import Icon from "../Icon";
import { Callout, KeyValueList } from "../ui";

export default function PolicyResult({ result, policyNumber }) {
  // Add safe defaults
  const flags = result?.flags || [];
  const details = result?.details || [];
  const state = result?.state || "idle";
  const message = result?.message || "";
  const label = result?.label || "Processing...";

  const isReviewOrInconclusive = state === "review" || state === "inconclusive";
  const hasReferenceIssue =
    flags.some((f) =>
      /reference|not found|missing|invalid|schedule|unverified|unknown/i.test(
        `${f.text} ${f.code || ""}`
      )
    ) ||
    result?.rawStatus === "NOT_FOUND" ||
    result?.rawStatus === "INVALID_POLICY";

  return (
    <div className="space-y-6">
      <p className="text-lg font-semibold text-white">{label}</p>
      {message && <p className="text-purple-200">{message}</p>}

      <div className="flex items-center gap-4 flex-wrap text-sm">
        {policyNumber && (
          <div className="text-purple-200">
            <span className="font-semibold text-white">Policy:</span>{" "}
            <code className="px-2 py-1 bg-purple-950 rounded text-purple-300 border border-purple-800">{policyNumber}</code>
          </div>
        )}
        {result?.rawStatus && (
          <div className="text-purple-300">
            API status: <code className="px-2 py-1 bg-purple-950 rounded text-purple-200 border border-purple-800">{result.rawStatus}</code>
          </div>
        )}
      </div>

      {flags.length > 0 ? (
        <div>
          <div className="text-xs font-bold tracking-wider text-purple-400 uppercase mb-3">
            Flags returned ({flags.length})
          </div>
          <ul className="space-y-2">
            {flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-3 p-4 bg-amber-950/30 border border-amber-700/40 rounded-lg text-amber-200">
                <Icon name="alert" size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
                <span className="flex-1 text-sm">
                  {flag.text}
                  {flag.code && <code className="ml-2 px-2 py-0.5 bg-amber-900/40 rounded text-xs">{flag.code}</code>}
                  {flag.severity && <em className="ml-2 text-xs font-semibold uppercase">{flag.severity}</em>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        state === "pass" && <p className="text-sm text-purple-300">The API returned no flags.</p>
      )}

      {(hasReferenceIssue || (isReviewOrInconclusive && flags.length > 0)) && (
        <Callout tone="warning" icon="info">
          <strong>Reference record verification</strong>
          <p>
            When a policy cannot be matched against active reference schedules or returns validation
            flags, automated rules cannot confirm coverage terms or incident timing. Verify the
            submitted policy number against the core policy administration system.
          </p>
        </Callout>
      )}

      {details.length > 0 && (
        <div>
          <div className="text-xs font-bold tracking-wider text-purple-400 uppercase mb-3">
            Additional details
          </div>
          <KeyValueList items={details} />
        </div>
      )}

      <p className="text-xs text-purple-400 leading-relaxed">
        Policy validation checks deterministic rules against reference records and does not constitute a final coverage decision.
      </p>
    </div>
  );
}
