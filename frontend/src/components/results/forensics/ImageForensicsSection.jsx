import { useState } from "react";
import Icon from "../../Icon";
import { Callout, Card, Spinner, StatusBadge } from "../../ui";
import { formatBytes } from "../../../lib/format.js";
import {
  extractForensicsOverview,
  normalizeAiGeneration,
  normalizeCompression,
  normalizeMetadata,
  normalizeQuality,
  normalizeReview,
} from "../../../lib/forensics.js";
import AiGenerationCard from "./AiGenerationCard";
import MetadataCard from "./MetadataCard";
import CompressionCard from "./CompressionCard";
import QualityCard from "./QualityCard";

export default function ImageForensicsSection({ record, check, onRetry }) {
  const overview = extractForensicsOverview(record);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const imagesList = overview.imagesList;
  const activeImage = imagesList[selectedIdx] || imagesList[0] || null;
  const activeDoc =
    overview.imageDocs[selectedIdx] ||
    (activeImage
      ? {
          name: activeImage.fileName,
          size: activeImage.fileSizeBytes ?? activeImage.size,
        }
      : overview.imageDocs[0] || null);

  const activeFileName =
    activeImage?.fileName || activeDoc?.name || "Uploaded claim image";
  const activeFileSize =
    activeImage?.fileSizeBytes ?? activeImage?.size ?? activeDoc?.size ?? null;
  const activeS3Key = activeImage?.s3Key || null;

  // Compute status for the active image
  const imageAnalyses = activeImage?.analyses || {};
  const activeAnalysesValues = Object.values(imageAnalyses);
  let activeImageStatus = "AWAITING_ANALYSIS";

  if (activeAnalysesValues.length > 0) {
    const completedCount = activeAnalysesValues.filter(
      (a) => a?.status === "COMPLETED"
    ).length;
    const errorCount = activeAnalysesValues.filter(
      (a) => a?.status === "ERROR"
    ).length;

    if (completedCount === activeAnalysesValues.length) {
      activeImageStatus = "COMPLETED";
    } else if (completedCount > 0 && errorCount > 0) {
      activeImageStatus = "PARTIAL";
    } else if (errorCount === activeAnalysesValues.length) {
      activeImageStatus = "FAILED";
    } else {
      activeImageStatus = "IN_PROGRESS";
    }
  } else if (overview.rawForensics?.analysisStatus) {
    activeImageStatus = overview.rawForensics.analysisStatus;
  }

  // Raw entries from API response
  const rawAiEntry = activeImage?.analyses?.aiGeneration || null;
  const rawMetaEntry =
    activeImage?.analyses?.metadata || overview.rawForensics?.metadata || null;
  const rawCompEntry =
    activeImage?.analyses?.compression ||
    overview.rawForensics?.compression ||
    null;
  const rawQualEntry =
    activeImage?.analyses?.imageQuality ||
    activeImage?.analyses?.quality ||
    overview.rawForensics?.quality ||
    null;
  const rawReviewEntry = activeImage?.review || null;

  const aiGeneration = normalizeAiGeneration(rawAiEntry, activeDoc);
  const metadata = normalizeMetadata(rawMetaEntry, activeDoc);
  const compression = normalizeCompression(rawCompEntry, activeDoc);
  const quality = normalizeQuality(rawQualEntry, activeDoc);
  const review = normalizeReview(rawReviewEntry);

  const isRunning =
    check?.status === "running" || overview.analysisState === "running";
  const isError =
    check?.status === "error" || overview.analysisState === "error";

  return (
    <section
      className="image-forensics-section mt"
      aria-labelledby="forensics-title"
    >
      <div className="section-head">
        <div>
          <div className="eyebrow">IMAGE FORENSICS</div>
          <h2 id="forensics-title" className="section-title">
            Image Forensics Analysis
          </h2>
          <p className="muted small">
            Multi-stage automated screening including Smaug AI-generation detection, EXIF container headers, DCT quantization tables, and OpenCV image quality.
          </p>
        </div>

        <div className="section-head-actions">
          <StatusBadge
            state={
              isError
                ? "error"
                : isRunning
                ? "idle"
                : overview.isSkipped
                ? "idle"
                : overview.analysisState === "pass"
                ? "pass"
                : overview.analysisState === "review"
                ? "review"
                : "idle"
            }
            label={overview.analysisStateLabel}
          />
          {isError && onRetry && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRetry}
            >
              <Icon name="refresh" size={14} /> Retry forensics check
            </button>
          )}
        </div>
      </div>

      {/* Telemetry Overview Card */}
      <Card className="forensics-overview-card">
        <div className="mini-label">Forensics Telemetry Overview</div>

        <div className="forensics-overview-grid">
          <div className="forensics-stat-tile">
            <span className="stat-label">Images submitted</span>
            <strong className="stat-value">{overview.imagesSubmitted}</strong>
            <span className="stat-sub muted small">
              {overview.imagesSubmitted === 1
                ? "1 image file"
                : `${overview.imagesSubmitted} image files`}
            </span>
          </div>

          <div className="forensics-stat-tile">
            <span className="stat-label">Checks completed</span>
            <strong className="stat-value">
              {isRunning
                ? "Running…"
                : overview.hasRawData
                ? `${overview.analysesCompleted} checks`
                : `${overview.imagesAnalyzed} processed`}
            </strong>
            <span className="stat-sub muted small">
              {overview.analysesWithErrors > 0
                ? `${overview.analysesWithErrors} warning / error`
                : "All checks completed"}
            </span>
          </div>

          <div className="forensics-stat-tile">
            <span className="stat-label">AI-generation screening</span>
            <strong
              className={`stat-value-status ${
                overview.aiGenerationStatus === "Completed"
                  ? "status-ok"
                  : overview.aiGenerationStatus === "Analyzing…"
                  ? "status-active"
                  : overview.aiGenerationStatus === "Error"
                  ? "status-error"
                  : "status-idle"
              }`}
            >
              {overview.aiGenerationStatus}
            </strong>
            <span className="stat-sub muted small">
              <code>Smaug-AI-Image-Detector</code>
            </span>
          </div>

          <div className="forensics-stat-tile">
            <span className="stat-label">Metadata analysis</span>
            <strong
              className={`stat-value-status ${
                overview.metadataStatus === "Completed"
                  ? "status-ok"
                  : overview.metadataStatus === "Analyzing…"
                  ? "status-active"
                  : overview.metadataStatus === "Error"
                  ? "status-error"
                  : "status-idle"
              }`}
            >
              {overview.metadataStatus}
            </strong>
            <span className="stat-sub muted small">
              <code>metadata_analyzer.py</code>
            </span>
          </div>

          <div className="forensics-stat-tile">
            <span className="stat-label">Compression analysis</span>
            <strong
              className={`stat-value-status ${
                overview.compressionStatus === "Completed"
                  ? "status-ok"
                  : overview.compressionStatus === "Analyzing…"
                  ? "status-active"
                  : overview.compressionStatus === "Error"
                  ? "status-error"
                  : "status-idle"
              }`}
            >
              {overview.compressionStatus}
            </strong>
            <span className="stat-sub muted small">
              <code>compression_analyzer.py</code>
            </span>
          </div>

          <div className="forensics-stat-tile">
            <span className="stat-label">Image quality analysis</span>
            <strong
              className={`stat-value-status ${
                overview.qualityStatus === "Completed"
                  ? "status-ok"
                  : overview.qualityStatus === "Analyzing…"
                  ? "status-active"
                  : overview.qualityStatus === "Error"
                  ? "status-error"
                  : "status-idle"
              }`}
            >
              {overview.qualityStatus}
            </strong>
            <span className="stat-sub muted small">
              <code>quality_analyzer.py</code>
            </span>
          </div>

          <div className="forensics-stat-tile">
            <span className="stat-label">Duplicate detection</span>
            <strong className="stat-value-status status-active">
              {overview.duplicateStatus}
            </strong>
            <span className="stat-sub muted small">Perceptual pHash engine</span>
          </div>
        </div>

        {/* Running state notice */}
        {isRunning && (
          <div className="forensics-pipeline-note">
            <Spinner label="" />
            <div>
              <strong>Analyzing uploaded image(s) with AWS Lambda &amp; Hugging Face ZeroGPU…</strong>
              <p className="muted small">
                Running Smaug AI detection, parsing EXIF metadata, extracting DCT quantization matrices, and calculating edge variance.
              </p>
            </div>
          </div>
        )}

        {/* Failed state notice */}
        {isError && (
          <Callout tone="danger" icon="alert">
            <strong>Image forensics analysis could not be completed</strong>
            <p>
              {check?.error ||
                "The forensics service encountered an issue processing the uploaded image keys."}
            </p>
            {onRetry && (
              <p className="mt">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onRetry}
                >
                  <Icon name="refresh" size={14} /> Retry forensics check
                </button>
              </p>
            )}
          </Callout>
        )}

        {/* Partial result notice */}
        {overview.rawForensics?.analysisStatus === "PARTIAL" && !isRunning && !isError && (
          <div className="forensics-pipeline-note note-warning mt-sm">
            <Icon name="alert" size={16} />
            <div>
              <strong>Partial Analysis Results</strong>
              <p className="muted small">
                One or more individual analyzers encountered an error or timeout. Successful checks and available telemetry are displayed below alongside coverage warnings.
              </p>
            </div>
          </div>
        )}

        {/* Skipped state notice */}
        {overview.isSkipped && !isRunning && !isError && (
          <div className="forensics-pipeline-note">
            <Icon name="info" size={16} />
            <div>
              <strong>No image files uploaded for this claim</strong>
              <p className="muted small">
                The claim contains no JPG, JPEG, or PNG images (or only PDFs). Image forensics was not executed.
              </p>
            </div>
          </div>
        )}

        {/* Multi-image selector (supports up to 3 images) */}
        {imagesList.length > 1 && (
          <div className="image-selector-row mt">
            <span className="small muted">
              <strong>Select image to inspect ({imagesList.length} images):</strong>
            </span>
            <div className="image-tabs">
              {imagesList.map((img, idx) => {
                const imgReviewReq = img.review?.required === true;
                return (
                  <button
                    key={`${img.s3Key || img.fileName}-${idx}`}
                    type="button"
                    className={`btn btn-sm ${
                      selectedIdx === idx ? "btn-primary" : "btn-secondary"
                    }`}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    <Icon name={imgReviewReq ? "alert" : "image"} size={14} />
                    <span>{img.fileName}</span>
                    <span className="muted small">
                      ({formatBytes(img.fileSizeBytes ?? img.size)})
                    </span>
                    {imgReviewReq && (
                      <span className="tab-flag-badge" title="Review required">
                        Review
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Selected Image Overview Header */}
      {!overview.isSkipped && (
        <Card className="active-image-header-card mt">
          <div className="image-overview-layout">
            <div className="image-overview-info">
              <div className="image-title-row">
                <Icon name="image" size={20} />
                <h3 className="image-overview-title">{activeFileName}</h3>
                <StatusBadge
                  state={
                    activeImageStatus === "COMPLETED"
                      ? "pass"
                      : activeImageStatus === "PARTIAL"
                      ? "review"
                      : activeImageStatus === "FAILED"
                      ? "error"
                      : "idle"
                  }
                  label={`Image Status: ${activeImageStatus}`}
                />
              </div>
              <div className="image-overview-meta mt-xs">
                <span>
                  Size: <strong>{formatBytes(activeFileSize)}</strong>
                </span>
                {activeS3Key && (
                  <span>
                    S3 Key: <code>{activeS3Key}</code>
                  </span>
                )}
                {imagesList.length > 1 && (
                  <span className="muted small">
                    (Image {selectedIdx + 1} of {imagesList.length})
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Human Review Recommendation Card */}
      {!overview.isSkipped && !isRunning && !isError && (
        <div
          className={`review-recommendation-card mt ${
            review.required ? "review-required-card" : "review-clear-card"
          }`}
        >
          <div className="review-rec-header">
            <div
              className={`review-rec-icon ${
                review.required ? "review-icon-warning" : "review-icon-neutral"
              }`}
            >
              <Icon
                name={review.required ? "alert" : "checkCircle"}
                size={22}
              />
            </div>
            <div className="review-rec-title-wrap">
              <div className="eyebrow">
                {review.required ? "ANALYST ACTION REQUIRED" : "ANALYST RECOMMENDATION"}
              </div>
              <h3 className="review-rec-title">
                {review.required
                  ? "Human Review Recommended"
                  : "No review flags detected"}
              </h3>
              <p className="review-rec-subtitle">
                {review.required
                  ? `Automated screening identified one or more forensic indicators for "${activeFileName}". A claims analyst should review this image against claim incident documentation.`
                  : `Automated screening did not detect indicators exceeding configured review thresholds for "${activeFileName}".`}
              </p>
            </div>
            <StatusBadge
              state={review.required ? "review" : "pass"}
              label={
                review.required
                  ? `Review (${review.priority} priority)`
                  : "No flags detected"
              }
            />
          </div>

          {/* Reasons for Human Review */}
          {review.required && review.reasons.length > 0 && (
            <div className="review-rec-section mt">
              <div className="mini-label">Flagged Reasons ({review.reasons.length})</div>
              <ul className="review-reasons-list">
                {review.reasons.map((reason, i) => (
                  <li key={i} className="review-reason-item">
                    <Icon name="alert" size={15} />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Neutral disclaimer when review is not required */}
          {!review.required && (
            <div className="review-neutral-notice mt">
              <Icon name="info" size={15} />
              <span>
                <strong>Important:</strong> &ldquo;No review flags detected&rdquo; does not establish that the image is authentic, unaltered, or fraud-free. Always corroborate photo evidence with policy details and incident records.
              </span>
            </div>
          )}

          {/* Coverage Warnings */}
          {review.coverageWarnings.length > 0 && (
            <div className="review-rec-section mt">
              <div className="mini-label">Coverage Warnings ({review.coverageWarnings.length})</div>
              <ul className="coverage-warnings-list">
                {review.coverageWarnings.map((warning, i) => (
                  <li key={i} className="coverage-warning-item">
                    <Icon name="info" size={15} />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Review Engine Limitations */}
          {review.limitations.length > 0 && (
            <div className="review-limitations mt-xs">
              <span className="muted small">
                <strong>Review limitations:</strong>{" "}
                {review.limitations.join(" • ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* The 4 Forensics Cards Grid */}
      <div className="forensics-cards-grid mt">
        <AiGenerationCard aiGeneration={aiGeneration} doc={activeDoc} />
        <MetadataCard metadata={metadata} doc={activeDoc} />
        <CompressionCard compression={compression} doc={activeDoc} />
        <QualityCard quality={quality} doc={activeDoc} />
      </div>

      <p className="muted small forensics-disclaimer mt">
        {overview.disclaimer}
      </p>
    </section>
  );
}
