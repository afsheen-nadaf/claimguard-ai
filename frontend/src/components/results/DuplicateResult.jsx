import { formatDate, formatINR } from "../../lib/format";

export default function DuplicateResult({ result, claimId }) {
  return (
    <>
      <p className="result-headline">{result.label}</p>
      {result.message && <p>{result.message}</p>}

      {result.kind === "no_match" && (
        <p className="muted small">
          No match was found in the configured reference claims or earlier submissions. The claim was registered for future comparisons.
        </p>
      )}
      {result.kind === "already_registered" && (
        <p className="muted small">
          Claim <code>{claimId}</code> was already registered, so this response reflects the stored record rather than a fresh comparison.
        </p>
      )}
      {result.kind === "unknown" && (
        <p className="muted small">The API returned a status this screen does not recognise. It has not been counted as a pass.</p>
      )}

      {result.matchType && <p className="small"><strong>Match type:</strong> {result.matchType}</p>}
      {result.matchedClaimId && <p className="small"><strong>Existing claim ID:</strong> <code>{result.matchedClaimId}</code></p>}

      {result.matches.length > 0 && (
        <div>
          <div className="mini-label">Matching claims ({result.matches.length})</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Claim ID</th><th>Policy</th><th>Incident date</th><th className="num">Amount</th><th>Source</th></tr>
              </thead>
              <tbody>
                {result.matches.map((m, i) => (
                  <tr key={`${m.claimId || "match"}-${i}`}>
                    <td data-label="Claim ID"><code>{m.claimId || "—"}</code></td>
                    <td data-label="Policy">{m.policyNumber || "—"}</td>
                    <td data-label="Incident date">{m.incidentDate ? formatDate(m.incidentDate) : "—"}</td>
                    <td data-label="Amount" className="num">{formatINR(m.claimAmountINR)}</td>
                    <td data-label="Source">{m.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="muted small">A duplicate match is an investigation signal, not proof of fraud.</p>
    </>
  );
}
