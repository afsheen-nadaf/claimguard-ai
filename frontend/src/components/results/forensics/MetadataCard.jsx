import { useState } from "react";
import Icon from "../../Icon";
import { Callout, KeyValueList, StatusBadge } from "../../ui";

export default function MetadataCard({ metadata, doc }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const isError = metadata?.status === "ERROR";
  const isAvailable = Boolean(
    metadata && !isError && (metadata.sha256 || metadata.imageFormat || metadata.width)
  );

  const decimalCoords = (() => {
    if (metadata?.latitude != null && metadata?.longitude != null) {
      return `${metadata.latitude},${metadata.longitude}`;
    }
    const match = String(metadata?.gpsCoordinates || "").match(
      /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/
    );
    return match ? `${match[1]},${match[2]}` : null;
  })();

  async function copyHash(hash) {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard fallback */
    }
  }

  const items = isAvailable
    ? [
        { label: "File name", value: metadata.fileName },
        { label: "File size", value: metadata.fileSize },
        { label: "Image format", value: metadata.imageFormat },
        {
          label: "Width and height",
          value:
            metadata.width && metadata.height
              ? `${metadata.width} × ${metadata.height} px`
              : "Not available",
        },
        { label: "Megapixels", value: metadata.megapixels || "Not available" },
        ...(metadata.orientationLabel
          ? [{ label: "Orientation", value: metadata.orientationLabel }]
          : []),
        {
          label: "SHA-256 fingerprint",
          value: metadata.sha256 ? (
            <span className="hash-wrap">
              <code>{metadata.sha256}</code>{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => copyHash(metadata.sha256)}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </span>
          ) : (
            "Not available"
          ),
        },
        {
          label: "EXIF availability",
          value: (
            <span className={`badge ${metadata.exifPresent ? "badge-success" : "badge-neutral"}`}>
              {metadata.exifAvailability}
            </span>
          ),
        },
        {
          label: "Camera make & model",
          value:
            metadata.cameraMake !== "Not available" || metadata.cameraModel !== "Not available"
              ? `${metadata.cameraMake !== "Not available" ? metadata.cameraMake : ""} ${
                  metadata.cameraModel !== "Not available" ? metadata.cameraModel : ""
                }`.trim()
              : "Not available",
        },
        {
          label: "Capture timestamp",
          value: metadata.captureTimestamp || "Not available",
        },
        {
          label: "GPS metadata",
          value: (
            <span className={`badge ${metadata.hasGps ? "badge-success" : "badge-neutral"}`}>
              {metadata.gpsAvailability}
            </span>
          ),
        },
        ...(metadata.gpsCoordinates
          ? [
              {
                label: "GPS coordinates",
                value: (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <code>{metadata.gpsCoordinates}</code>
                    {decimalCoords && (
                      <a
                        href={`https://www.google.com/maps?q=${encodeURIComponent(decimalCoords)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-button inline-flex items-center gap-1"
                      >
                        <span>View in map</span>
                        <Icon name="arrow" size={13} />
                      </a>
                    )}
                  </span>
                ),
              },
            ]
          : []),
        {
          label: "Software metadata",
          value: metadata.software || "Not detected",
        },
        {
          label: "Editing software indicator",
          value: metadata.editingSoftwareDetected ? (
            <span className="badge badge-warning">
              {metadata.matchedEditor ? `Editor (${metadata.matchedEditor})` : "Editor tag detected"}
            </span>
          ) : (
            <span className="badge badge-neutral">Not detected</span>
          ),
        },
      ]
    : [];

  const findings = metadata?.findings || [];
  const exifEntries = Object.entries(metadata?.exifMetadata || {});

  return (
    <div className="card forensics-card">
      <div className="card-header">
        <div className="card-icon">
          <Icon name="file" size={20} />
        </div>
        <div className="card-title-wrap">
          <h3 className="card-title">2. Metadata &amp; EXIF Analysis</h3>
          <p className="card-description">
            Container headers, device telemetry, GPS coordinates, software tags, and SHA-256 hash (<code>metadata_analyzer.py</code>).
          </p>
        </div>
        <div className="card-header-actions">
          <StatusBadge
            state={isError ? "error" : isAvailable ? "pass" : "idle"}
            label={
              isError ? "Analyzer error" : isAvailable ? "Completed" : "Awaiting analysis"
            }
          />
          {isAvailable && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse metadata details" : "Expand metadata details"}
              title={expanded ? "Collapse details" : "Expand details"}
            >
              <Icon
                name="chevron"
                size={16}
                className={expanded ? "chevron-open" : "chevron-closed"}
              />
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <div className="forensics-body">
          <Callout tone="danger" icon="alert">
            <strong>Metadata analysis error</strong>
            <p>{metadata.error || "The metadata analyzer encountered an error processing this image."}</p>
            <p className="muted small mt">
              Metadata could not be parsed for this file. Other forensic checks remain available.
            </p>
          </Callout>
        </div>
      ) : isAvailable ? (
        <div className="forensics-body">
          <div className="mini-label">File &amp; Device Telemetry</div>
          <KeyValueList items={items} />

          {metadata.timestampNote && (
            <Callout tone="info" icon="info">
              <strong>Incident date context</strong>
              <p>{metadata.timestampNote}</p>
            </Callout>
          )}

          {findings.length > 0 && (
            <div className="mt">
              <div className="mini-label">Metadata Notes ({findings.length})</div>
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
                        <strong>
                          <code>{f.code}</code>
                        </strong>
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

          {expanded && exifEntries.length > 0 && (
            <details className="raw-details mt">
              <summary>
                <Icon name="chevron" size={15} /> EXIF metadata tags ({exifEntries.length})
              </summary>
              <div className="table-wrap mt">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exifEntries.map(([k, v]) => (
                      <tr key={k}>
                        <td>
                          <code>{k}</code>
                        </td>
                        <td>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="forensics-body">
          <Callout tone="info" icon="info">
            <strong>Analysis not available</strong>
            <p>Metadata and EXIF analysis has not completed for this file.</p>
            {doc?.name && (
              <p>
                Document: <strong>{doc.name}</strong>
              </p>
            )}
          </Callout>
        </div>
      )}

      <p className="muted small forensics-disclaimer">
        Missing metadata is shown as &ldquo;Not available&rdquo; or &ldquo;Not detected&rdquo; and is not treated as proof of tampering. Mobile platforms and messaging apps regularly strip or alter metadata headers upon upload.
      </p>
    </div>
  );
}