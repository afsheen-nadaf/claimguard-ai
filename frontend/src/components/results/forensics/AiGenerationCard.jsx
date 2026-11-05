import { useState } from "react";
import Icon from "../../Icon";
import { Callout, KeyValueList, StatusBadge } from "../../ui";

export default function AiGenerationCard({ aiGeneration, doc }) {
  const [expanded, setExpanded] = useState(true);

  const isCompleted = Boolean(aiGeneration?.isCompleted && aiGeneration.score != null);
  const isError = aiGeneration?.status === "ERROR";
  const isUnavailable = !isCompleted && !isError;

  const percentage = aiGeneration?.percentage;
  const score = aiGeneration?.score;
  const modelName = aiGeneration?.model || "abacusai/Smaug-AI-Image-Detector";
  const interpretation = aiGeneration?.interpretation || "AI-generation screening completed.";
  const disclaimer = aiGeneration?.disclaimer;

  const items = isCompleted
    ? [
        { label: "Detector model", value: <code>{modelName}</code> },
        {
          label: "Screening score",
          value: (
            <span>
              <strong>{Number(score).toFixed(6)}</strong>{" "}
              <span className="muted small">(normalized scale 0.00 to 1.00)</span>
            </span>
          ),
        },
        {
          label: "AI-generation signal",
          value: (
            <span>
              <strong>{percentage}%</strong>{" "}
              <span className="muted small">(model signal strength, uncalibrated)</span>
            </span>
          ),
        },
        {
          label: "Interpretation",
          value: (
            <span
              className={`badge ${
                percentage >= 50 ? "badge-warning" : "badge-success"
              }`}
            >
              {interpretation}
            </span>
          ),
        },
        {
          label: "Review threshold",
          value: "0.50 (50.00% signal strength triggers human review flag)",
        },
        {
          label: "Hosting environment",
          value: "Hugging Face ZeroGPU · Zero-shot Smaug Detector",
        },
      ]
    : [];

  return (
    <div className="card forensics-card ai-generation-card">
      <div className="card-header">
        <div className="card-icon ai-card-icon">
          <Icon name="shield" size={20} />
        </div>
        <div className="card-title-wrap">
          <h3 className="card-title">1. AI-Generation Screening (Smaug)</h3>
          <p className="card-description">
            Deep-learning screening for synthetic AI-generated imagery hosted on Hugging Face ZeroGPU (<code>{modelName}</code>).
          </p>
        </div>
        <div className="card-header-actions">
          <StatusBadge
            state={isError ? "error" : isCompleted ? (percentage >= 50 ? "review" : "pass") : "idle"}
            label={
              isError
                ? "Analyzer error"
                : isCompleted
                ? percentage >= 50
                  ? "Elevated signal"
                  : "Completed"
                : "Awaiting analysis"
            }
          />
          {isCompleted && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse AI-generation details" : "Expand AI-generation details"}
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
            <strong>AI-generation detector error</strong>
            <p>
              {aiGeneration.error ||
                "The Smaug AI detector encountered an issue analyzing this image. The Hugging Face Space may be temporarily unreachable or warming up."}
            </p>
            <p className="muted small mt">
              <strong>Note:</strong> A screening score is not available. To avoid false assurance, the score is not assumed to be 0%. Other forensic checks remain available below.
            </p>
          </Callout>
        </div>
      ) : isCompleted ? (
        <div className="forensics-body">
          {/* Signal Score and Visual Gauge */}
          <div className="ai-score-banner">
            <div className="ai-score-metric">
              <span className="mini-label">AI-Generation Signal Strength</span>
              <div className="ai-score-display">
                <span
                  className={`ai-score-large ${
                    percentage >= 50
                      ? "text-warning"
                      : percentage >= 25
                      ? "text-neutral"
                      : "text-success"
                  }`}
                >
                  {percentage}%
                </span>
                <div className="ai-score-subtext">
                  <span className="muted small">
                    Score: <strong>{Number(score).toFixed(4)}</strong> (0–1 scale)
                  </span>
                  <span
                    className={`badge badge-sm ${
                      percentage >= 50 ? "badge-warning" : "badge-neutral"
                    }`}
                  >
                    {interpretation}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Gauge Bar */}
            <div className="ai-gauge-block mt">
              <div className="meter-label">
                <span>Signal level: {percentage < 25 ? "Low" : percentage < 50 ? "Moderate" : "Elevated"}</span>
                <span>Threshold: 50%</span>
              </div>
              <div className="ai-gauge-track">
                <div
                  className={`ai-gauge-fill ${
                    percentage >= 50
                      ? "gauge-high"
                      : percentage >= 25
                      ? "gauge-moderate"
                      : "gauge-low"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(3, percentage))}%`,
                  }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentage}
                  aria-label="AI-generation signal strength percentage"
                />
                <div
                  className="ai-gauge-threshold-marker"
                  style={{ left: "50%" }}
                  title="50% Review Threshold"
                />
              </div>
              <div className="meter-range-labels">
                <span>0% (Low AI signal)</span>
                <span className="threshold-label">▲ 50% Review Threshold</span>
                <span>100% (High AI signal)</span>
              </div>
            </div>

            <div className="ai-signal-notice mt-xs">
              <Icon name="info" size={14} />
              <span>
                A higher score indicates a stronger AI-generation signal from Smaug. This metric reflects model feature alignment, <strong>not</strong> a calibrated mathematical probability.
              </span>
            </div>
          </div>

          {expanded && (
            <>
              <div className="mini-label mt">Model Telemetry</div>
              <KeyValueList items={items} />

              {/* Model limitations callout */}
              <div className="ai-limitations-box mt">
                <Callout
                  tone={percentage >= 50 ? "warning" : "info"}
                  icon={percentage >= 50 ? "alert" : "shield"}
                >
                  <strong>Important Screening &amp; Model Limitations</strong>
                  <ul className="limitation-bullet-list mt-xs">
                    <li>
                      <strong>AI Generation vs. Image Manipulation:</strong> Smaug screens for fully AI-generated images. It may miss localized AI edits (such as inpainting, object insertion, or subtle face edits) in an otherwise genuine photograph.
                    </li>
                    <li>
                      <strong>No Automatic Fraud Determination:</strong> Never make an automated claims decision based solely on this score. It is an investigatory screening indicator.
                    </li>
                    <li>
                      <strong>Human Verification Required:</strong> Flagged images must be reviewed by a human claims analyst in conjunction with policy terms, damage reports, and metadata.
                    </li>
                  </ul>
                  {disclaimer && (
                    <p className="muted small mt-xs disclaimer-footnote">
                      <em>{disclaimer}</em>
                    </p>
                  )}
                </Callout>
              </div>
            </>
          )}
        </div>
      ) : isUnavailable ? (
        <div className="forensics-body">
          <Callout tone="info" icon="info">
            <strong>AI-generation screening not available</strong>
            <p>
              Smaug AI-generation analysis has not run or returned results for this file.
            </p>
            {doc?.name && (
              <p>
                Document: <strong>{doc.name}</strong>
              </p>
            )}
            <p className="muted small mt">
              <strong>Note:</strong> A score of 0% is not displayed when analysis is unavailable. Other forensic checks are shown below.
            </p>
          </Callout>
        </div>
      ) : null}

      <p className="muted small forensics-disclaimer">
        Smaug AI-generation detection identifies synthetic image features. It does not replace human assessment and does not detect all localized photo manipulations.
      </p>
    </div>
  );
}
