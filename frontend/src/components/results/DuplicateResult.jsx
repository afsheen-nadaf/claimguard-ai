
import Icon from "../Icon";
import { Callout } from "../ui";
import { formatDate, formatINR } from "../../lib/format";

export default function DuplicateResult({ result, claimId }) {
  const matches = result?.matches || [];
  const imageMatches = result?.imageMatches || [];

  return (
    <>
      <p className="result-headline">{result?.label}</p>
      {result?.message && <p>{result.message}</p>}

      {result?.kind === "no_match" && (
        <p className="muted small">
          No match was found in the configured reference claims or earlier
          submissions. The claim was registered for future comparisons.
        </p>
      )}

      {result?.kind === "already_registered" && (
        <p className="muted small">
          Claim <code>{claimId}</code> was already registered. This response
          reflects the stored record rather than a fresh comparison.
        </p>
      )}

      {result?.kind === "unknown" && (
        <p className="muted small">
          The API returned a status this screen does not recognise.
          It has not been counted as a pass.
        </p>
      )}

      {/* Section 1: Traditional claim matching */}
      <div className="duplicate-sub-section">
        <div className="mini-label">1. Traditional Claim Matching (Policy / Date / Amount)</div>

        {result?.matchType && (
          <p className="small">
            <strong>Match type:</strong> <code>{result.matchType}</code>
          </p>
        )}

        {result?.matchedClaimId && (
          <p className="small">
            <strong>Existing claim ID:</strong>{" "}
            <code>{result.matchedClaimId}</code>
          </p>
        )}

        {matches.length > 0 ? (
          <div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Claim ID</th>
                    <th>Policy</th>
                    <th>Incident date</th>
                    <th className="num">Amount</th>
                    <th>Match source</th>
                    <th>Match type</th>
                  </tr>
                </thead>

                <tbody>
                  {matches.map((m, i) => (
                    <tr key={`${m.claimId || "match"}-${i}`}>
                      <td data-label="Claim ID">
                        <code>{m.claimId || "—"}</code>
                      </td>
                      <td data-label="Policy">{m.policyNumber || "—"}</td>
                      <td data-label="Incident date">
                        {m.incidentDate ? formatDate(m.incidentDate) : "—"}
                      </td>
                      <td data-label="Amount" className="num">
                        {formatINR(m.claimAmountINR)}
                      </td>
                      <td data-label="Match source">{m.source || "REFERENCE_SET"}</td>
                      <td data-label="Match type">
                        <code>{m.matchType || result.matchType || "EXACT_FIELDS"}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="muted small">
            No matching claim record found by policy number, incident date, or claim amount.
          </p>
        )}
      </div>

      {/* Section 2: Image-based duplicate detection */}
      <div className="duplicate-sub-section">
        <div className="mini-label">2. Image-Based Duplicate Detection (Perceptual Hash)</div>

        {imageMatches.length > 0 ? (
          <div className="image-matches-container">
            <div className="image-match-cards">
              {imageMatches.map((m, i) => (
                <div
                  key={`${m.matchedImageId || m.claimId || "image"}-${i}`}
                  className="image-match-card"
                >
                  <div className="image-match-head">
                    <span className="badge badge-warning">
                      <Icon name="alert" size={13} />
                      Potential Image Duplicate
                    </span>
                    <span className="image-match-source muted small">
                      Source: <code>{m.source || "IMAGE_HASH"}</code>
                    </span>
                  </div>

                  <div className="image-match-stats">
                    <div className="image-match-stat">
                      <span className="stat-label">Similarity</span>
                      <strong className="stat-val highlight">
                        {m.similarityPercent != null ? `${m.similarityPercent}%` : "—"}
                      </strong>
                    </div>

                    <div className="image-match-stat">
                      <span className="stat-label">Hamming Distance</span>
                      <strong className="stat-val">
                        {m.hammingDistance ?? "—"} <span className="muted small">/ 64</span>
                      </strong>
                    </div>

                    <div className="image-match-stat">
                      <span className="stat-label">Existing Claim</span>
                      <strong className="stat-val">
                        <code>{m.claimId || "—"}</code>
                      </strong>
                    </div>
                  </div>

                  {(m.matchedImageId || m.uploadedImageKey) && (
                    <div className="image-match-details">
                      {m.matchedImageId && (
                        <div>
                          <span className="muted small">Matched image ID:</span>{" "}
                          <code>{m.matchedImageId}</code>
                        </div>
                      )}
                      {m.uploadedImageKey && (
                        <div>
                          <span className="muted small">Uploaded image key:</span>{" "}
                          <code>{m.uploadedImageKey}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="table-wrap mt">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Existing Claim ID</th>
                    <th className="num">Similarity</th>
                    <th className="num">Hamming Distance</th>
                    <th>Matched Image ID</th>
                    <th>Source</th>
                  </tr>
                </thead>

                <tbody>
                  {imageMatches.map((m, i) => (
                    <tr key={`tbl-${m.matchedImageId || m.claimId || "image"}-${i}`}>
                      <td data-label="Existing Claim ID">
                        <code>{m.claimId || "—"}</code>
                      </td>
                      <td data-label="Similarity" className="num">
                        <strong>
                          {m.similarityPercent != null ? `${m.similarityPercent}%` : "—"}
                        </strong>
                      </td>
                      <td data-label="Hamming Distance" className="num">
                        {m.hammingDistance ?? "—"} / 64
                      </td>
                      <td data-label="Matched Image ID">
                        {m.matchedImageId ? <code>{m.matchedImageId}</code> : "—"}
                      </td>
                      <td data-label="Source">{m.source || "IMAGE_HASH"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-inline-state">
            <Icon name="checkCircle" size={18} className="text-success" />
            <div>
              <strong>No Image Matches Found</strong>
              <p className="muted small">
                Perceptual hashing (pHash) found no visual duplicates matching reference or
                previously submitted claim images within the similarity threshold.
              </p>
            </div>
          </div>
        )}

        <Callout tone="info" icon="info">
          <strong>Perceptual image hashing methodology</strong>
          <p>
            Perceptual hashing computes a 64-bit structural fingerprint of uploaded images to identify
            visually similar copies regardless of re-scaling, format conversion, or minor compression.
            A low Hamming distance indicates high visual similarity.
          </p>
          <p>
            Visually similar images are not necessarily fraudulent: common vehicle angles, stock parts,
            or identical incident documentation can legitimately share visual features. These findings
            are investigation indicators for analyst review, not proof of fraud.
          </p>
        </Callout>
      </div>

      <p className="muted small">
        Duplicate claim detection evaluates both metadata (policy, date, amount) and perceptual image
        hashes independently. A duplicate match is an investigation signal, not proof of fraud.
      </p>
    </>
  );
}
