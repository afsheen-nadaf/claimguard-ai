import Icon from "../Icon";
import { Callout, KeyValueList } from "../ui";

export default function PolicyResult({ result, policyNumber }) {
  const isReviewOrInconclusive = result.state === "review" || result.state === "inconclusive";
  const hasReferenceIssue =
    result.flags?.some((f) =>
      /reference|not found|missing|invalid|schedule|unverified|unknown/i.test(
        `${f.text} ${f.code || ""}`
      )
    ) ||
    result.rawStatus === "NOT_FOUND" ||
    result.rawStatus === "INVALID_POLICY";

  return (
    <>
      <p className="result-headline">{result.label}</p>
      {result.message && <p>{result.message}</p>}

      <div className="result-meta-tags">
        {policyNumber && (
          <p className="small">
            <strong>Policy number:</strong> <code>{policyNumber}</code>
          </p>
        )}
        {result.rawStatus && (
          <p className="muted small">
            API status: <code>{result.rawStatus}</code>
          </p>
        )}
      </div>

      {result.flags.length > 0 ? (
        <div>
          <div className="mini-label">Flags returned ({result.flags.length})</div>
          <ul className="flag-list">
            {result.flags.map((flag, i) => (
              <li key={i}>
                <Icon name="alert" size={16} />
                <span>
                  {flag.text}
                  {flag.code && <code>{flag.code}</code>}
                  {flag.severity && <em>{flag.severity}</em>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        result.state === "pass" && <p className="muted small">The API returned no flags.</p>
      )}

      {(hasReferenceIssue || (isReviewOrInconclusive && result.flags.length > 0)) && (
        <Callout tone="warning" icon="info">
          <strong>Reference record verification</strong>
          <p>
            When a policy cannot be matched against active reference schedules or returns validation
            flags, automated rules cannot confirm coverage terms or incident timing. Verify the
            submitted policy number against the core policy administration system.
          </p>
        </Callout>
      )}

      {result.details.length > 0 && (
        <div>
          <div className="mini-label">Additional details</div>
          <KeyValueList items={result.details} />
        </div>
      )}

      <p className="muted small">
        Policy validation checks deterministic rules against reference records and does not constitute a final coverage decision.
      </p>
    </>
  );
}
