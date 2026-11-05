import { useState } from "react";
import Icon from "../../Icon";
import { Callout, KeyValueList, StatusBadge } from "../../ui";

export default function QualityCard({ quality, doc }) {
  const [expanded, setExpanded] = useState(true);

  const isError = quality?.status === "ERROR";
  const isAvailable = Boolean(
    quality &&
      !isError &&
      (quality.blurScore != null || quality.brightnessScore != null || quality.dimensions !== "—")
  );

  const items = isAvailable
    ? [
        { label: "Image dimensions", value: quality.dimensions || "Not available" },
        { label: "Megapixels", value: quality.megapixels || "Not available" },
        {
          label: "Blur score (Laplacian var)",
          value: quality.blurScore != null ? Number(quality.blurScore).toFixed(2) : "Not available",
        },
        {
          label: "Brightness score (Mean lum)",
          value:
            quality.brightnessScore != null
              ? `${Number(quality.brightnessScore).toFixed(2)} / 255`
              : "Not available",
        },
        {
          label: "Contrast score (Std dev)",
          value: quality.contrastScore != null ? Number(quality.contrastScore).toFixed(2) : "Not available",
        },
        {
          label: "Noise estimate (Std dev)",
          value: quality.noiseEstimate != null ? Number(quality.noiseEstimate).toFixed(2) : "Not available",
        },
      ]
    : [];

  const findings = quality?.findings || [];

  return (
    <div className="card forensics-card">
      <div className="card-header">
        <div className="card-icon">
          <Icon name="chart" size={20} />
        </div>
        <div className="card-title-wrap">
          <h3 className="card-title">4. Image Quality Analysis</h3>
          <p className="card-description">
            Edge sharpness (Laplacian variance), illumination uniformity, contrast spread, and noise estimation (<code>quality_analyzer.py</code>).
          </p>
        </div>
        <div className="card-header-actions">
          <StatusBadge
            state={isError ? "error" : isAvailable ? "pass" : "idle"}
            label={
              isError
                ? "Analyzer error"
                : isAvailable
                ? "Completed"
                : "Awaiting analysis"
            }
          />
          {isAvailable && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse quality details" : "Expand quality details"}
              title={expanded ? "Collapse details" : "Expand details"}
            >
              <Icon name="chevron" size={16} className={expanded ? "chevron-open" : "chevron-closed"} />
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <div className="forensics-body">
          <Callout tone="danger" icon="alert">
            <strong>Image quality analysis error</strong>
            <p>{quality.error || "The image quality analyzer encountered an error processing this image."}</p>
            <p className="muted small mt">
              Quality metrics could not be computed. Other forensic checks remain available.
            </p>
          </Callout>
        </div>
      ) : isAvailable ? (
        <div className="forensics-body">
          <div className="mini-label">Quantitative Quality Metrics</div>
          <KeyValueList items={items} />

          {/* Visual indicators for scores */}
          {expanded && (
            <div className="quality-meters mt">
              <div className="mini-label">Visual Metric Indicators</div>

              {quality.blurScore != null && (
                <div className="meter-row">
                  <div className="meter-label">
                    <span>Sharpness / Blur (Laplacian variance)</span>
                    <strong>{Number(quality.blurScore).toFixed(2)}</strong>
                  </div>
                  <div className="meter-track">
                    <div
                      className={`meter-fill ${
                        quality.blurScore < 50 ? "meter-warning" : "meter-good"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(5, (quality.blurScore / 300) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="meter-range-labels">
                    <span>Soft / Low focus (&lt;50)</span>
                    <span>Sharp baseline (&gt;50)</span>
                  </div>
                </div>
              )}

              {quality.brightnessScore != null && (
                <div className="meter-row">
                  <div className="meter-label">
                    <span>Brightness / Exposure (0–255)</span>
                    <strong>{Number(quality.brightnessScore).toFixed(2)} / 255</strong>
                  </div>
                  <div className="meter-track">
                    <div
                      className={`meter-fill ${
                        quality.brightnessScore < 40 || quality.brightnessScore > 215
                          ? "meter-warning"
                          : "meter-good"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(5, (quality.brightnessScore / 255) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="meter-range-labels">
                    <span>Dark (&lt;40)</span>
                    <span>Balanced exposure (40–215)</span>
                    <span>Overexposed (&gt;215)</span>
                  </div>
                </div>
              )}

              {quality.contrastScore != null && (
                <div className="meter-row">
                  <div className="meter-label">
                    <span>Luminance Contrast (Std dev)</span>
                    <strong>{Number(quality.contrastScore).toFixed(2)}</strong>
                  </div>
                  <div className="meter-track">
                    <div
                      className={`meter-fill ${
                        quality.contrastScore < 25 ? "meter-warning" : "meter-good"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(5, (quality.contrastScore / 80) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="meter-range-labels">
                    <span>Low contrast (&lt;25)</span>
                    <span>Dynamic range (&gt;25)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {findings.length > 0 && (
            <div className="mt">
              <div className="mini-label">Quality Observations ({findings.length})</div>
              <ul className="forensics-findings-list">
                {findings.map((f, i) => (
                  <li
                    key={i}
                    className={`finding-item ${
                      f.severity === "warning"
                        ? "finding-warning"
                        : f.severity === "error"
                        ? "finding-danger"
                        : "finding-info"
                    }`}
                  >
                    <Icon
                      name={
                        f.severity === "warning"
                          ? "alert"
                          : f.severity === "error"
                          ? "xCircle"
                          : "info"
                      }
                      size={16}
                    />
                    <div className="finding-content">
                      <div className="finding-header">
                        <strong><code>{f.code}</code></strong>
                        {f.severity && (
                          <span
                            className={`badge badge-sm badge-${
                              f.severity === "warning"
                                ? "warning"
                                : f.severity === "error"
                                ? "danger"
                                : "neutral"
                            }`}
                          >
                            {f.severity}
                          </span>
                        )}
                      </div>
                      <p className="small muted">{f.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="forensics-body">
          <Callout tone="info" icon="info">
            <strong>Analysis not available</strong>
            <p>
              Image quality analysis has not completed for this file.
            </p>
            {doc?.name && (
              <p>
                Document: <strong>{doc.name}</strong>
              </p>
            )}
          </Callout>
        </div>
      )}

      <p className="muted small forensics-disclaimer">
        Quality heuristics describe photographic properties such as lighting, resolution, and focus. They are descriptive visual metrics and do not prove manipulation or fraud.
      </p>
    </div>
  );
}
