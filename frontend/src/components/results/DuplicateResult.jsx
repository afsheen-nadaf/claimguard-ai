
import { useState } from "react";
import Icon from "../Icon";
import { Callout } from "../ui";
import { formatDate, formatINR } from "../../lib/format";

export default function DuplicateResult({ result, claimId }) {
  const [showImageDetails, setShowImageDetails] = useState(false);
  const [showImageIds, setShowImageIds] = useState({});
  const [showAllMatches, setShowAllMatches] = useState(false);
  const matches = result?.matches || [];
  const imageMatches = result?.imageMatches || [];
  const matchCount = Math.max(matches.length, result?.matchCount || 0);
  const imageMatchCount = Math.max(imageMatches.length, result?.imageMatchCount || 0);

  return (
    <>
      <p className="result-headline">{result?.label}</p>
      {result?.message && <p className="text-[#f5f0e8]">{result.message}</p>}

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
        <div className="mini-label text-[#f5f0e8]">1. Traditional Claim Matching (Policy / Date / Amount)</div>

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
                  {(showAllMatches ? matches : matches.slice(0, 1)).map((m, i) => (
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
            {matches.length > 1 && (
              <div className="text-center mt-4 mb-6">
                <button
                  type="button"
                  onClick={() => setShowAllMatches(!showAllMatches)}
                  className="text-xs text-purple-300 hover:text-purple-100 transition-colors lowercase tracking-wide font-semibold"
                >
                  {showAllMatches ? '− show less' : `+ show ${matches.length - 1} more ${matches.length - 1 === 1 ? 'match' : 'matches'}`}
                </button>
              </div>
            )}
          </div>
        ) : matchCount > 0 ? (
          <p className="muted small">
            {matchCount} potential claim match{matchCount === 1 ? "" : "es"} found. Record-level details are restricted to adjuster review.
          </p>
        ) : (
          <p className="muted small">
            No matching claim record found by policy number, incident date, or claim amount.
          </p>
        )}
      </div>

      {/* Section 2: Image-based duplicate detection */}
      <div className="duplicate-sub-section">
        <div className="mini-label text-[#f5f0e8]">2. Image-Based Duplicate Detection (Perceptual Hash)</div>

        {imageMatches.length > 0 ? (
          <div className="image-matches-container">
            {/* Show only first card initially */}
            <div className="image-match-cards space-y-6">
              {(showImageDetails ? imageMatches : [imageMatches[0]]).map((m, i) => (
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
                          {showImageIds[i] ? (
                            <>
                              {m.matchedImageId && (
                                <div>
                                  <span className="muted small">Matched image ID:</span>{" "}
                                  <code className="text-xs">{m.matchedImageId}</code>
                                </div>
                              )}
                              {m.uploadedImageKey && (
                                <div>
                                  <span className="muted small">Uploaded image key:</span>{" "}
                                  <code className="text-xs">{m.uploadedImageKey}</code>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowImageIds({...showImageIds, [i]: false})}
                                className="text-xs text-amber-300 hover:text-amber-100 transition-colors lowercase tracking-wide font-semibold mt-2"
                              >
                                − hide image IDs
                              </button>
                            </>
                          ) : imageMatchCount > 0 ? (
                            <p className="muted small">
                              {imageMatchCount} potential image match{imageMatchCount === 1 ? "" : "es"} found. Record-level details are restricted to adjuster review.
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowImageIds({...showImageIds, [i]: true})}
                              className="text-xs text-amber-300 hover:text-amber-100 transition-colors lowercase tracking-wide font-semibold"
                            >
                              + show image IDs
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
            </div>

            {/* Show More / Show Less Link */}
            {imageMatches.length > 1 && (
              <div className="text-center mt-2 mb-6">
                <button
                  type="button"
                  onClick={() => setShowImageDetails(!showImageDetails)}
                  className="text-xs text-amber-300 hover:text-amber-100 transition-colors lowercase tracking-wide font-semibold"
                >
                  {showImageDetails ? '− show less' : `+ show ${imageMatches.length - 1} more`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-inline-state">
            <Icon name="checkCircle" size={18} className="text-success" />
            <div>
              <strong className="text-[#f5f0e8]">No Image Matches Found</strong>
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
