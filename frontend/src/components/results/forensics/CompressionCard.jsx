import { useState } from "react";
import Icon from "../../Icon";
import { Callout, KeyValueList, StatusBadge } from "../../ui";

export default function CompressionCard({ compression, doc }) {
  const [expanded, setExpanded] = useState(true);

  const isError = compression?.status === "ERROR";
  const isAvailable = Boolean(compression && !isError && compression.imageFormat);

  const items = isAvailable
    ? [
        { label: "Image format", value: compression.imageFormat || "JPEG" },
        { label: "File type", value: compression.fileType || compression.imageFormat || "—" },
        {
          label: "Quantization tables",
          value: compression.isPng ? (
            <span className="muted">Not applicable (PNG format)</span>
          ) : compression.hasQuantizationTables ? (
            `${compression.quantizationTableCount} table${compression.quantizationTableCount === 1 ? "" : "s"}`
          ) : (
            "Not available in bitstream"
          ),
        },
        ...(!compression.isPng && compression.hasQuantizationTables
          ? [
              {
                label: "Coefficient count",
                value: compression.coefficientCount ? `${compression.coefficientCount} coefficients / table` : "—",
              },
              {
                label: "Minimum coefficient",
                value: compression.minCoefficient ?? "—",
              },
              {
                label: "Maximum coefficient",
                value: compression.maxCoefficient ?? "—",
              },
              {
                label: "Mean coefficient",
                value: compression.meanCoefficient ?? "—",
              },
            ]
          : []),
        {
          label: "Encoding process",
          value: compression.encodingProcess || "Not available",
        },
        {
          label: "YCbCr subsampling",
          value: compression.ycbcrSubsampling || "Not available",
        },
        {
          label: "Bits per sample",
          value:
            compression.bitsPerSample != null
              ? `${compression.bitsPerSample} bits/channel`
              : "Not available",
        },
        {
          label: "ExifTool compression status",
          value: (
            <span className={`badge ${compression.exiftoolStatus === "AVAILABLE" ? "badge-success" : "badge-neutral"}`}>
              {compression.exiftoolStatus === "AVAILABLE" ? "Available" : "Not installed in runtime"}
            </span>
          ),
        },
      ]
    : [];

  const findings = compression?.findings || [];
  const rawTables = compression?.quantizationTables
    ? Object.entries(compression.quantizationTables)
    : [];

  return (
    <div className="card forensics-card">
      <div className="card-header">
        <div className="card-icon">
          <Icon name="layers" size={20} />
        </div>
        <div className="card-title-wrap">
          <h3 className="card-title">3. Compression Analysis</h3>
          <p className="card-description">
            Quantization tables (DCT matrices), chroma subsampling (YCbCr), and bitstream encoding (<code>compression_analyzer.py</code>).
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
              aria-label={expanded ? "Collapse compression details" : "Expand compression details"}
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
            <strong>Compression analysis error</strong>
            <p>{compression.error || "The compression analyzer encountered an error processing this image."}</p>
            <p className="muted small mt">
              Compression telemetry could not be extracted. Other forensic checks remain available.
            </p>
          </Callout>
        </div>
      ) : isAvailable ? (
        <div className="forensics-body">
          <div className="mini-label">Compression Telemetry</div>
          <KeyValueList items={items} />

          {compression.isPng ? (
            <Callout tone="info" icon="info">
              <strong>PNG format notice</strong>
              <p>
                JPEG-specific compression tables are not applicable to this image format.
              </p>
              <p className="muted small">
                PNG uses lossless DEFLATE compression rather than lossy discrete cosine transform (DCT) quantization matrices. This is normal and expected for PNG files.
              </p>
            </Callout>
          ) : !compression.hasQuantizationTables ? (
            <Callout tone="info" icon="info">
              <strong>Quantization tables not present</strong>
              <p>
                Quantization matrices could not be extracted from this image stream. This can occur with progressive JPEG encodings, re-compressed mobile streams, or web-optimized gateways.
              </p>
              <p className="muted small">
                This does not indicate tampering or fraudulent alteration.
              </p>
            </Callout>
          ) : null}

          {findings.length > 0 && (
            <div className="mt">
              <div className="mini-label">Compression Findings ({findings.length})</div>
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

          {expanded && rawTables.length > 0 && (
            <details className="raw-details mt">
              <summary>
                <Icon name="chevron" size={15} /> Quantization table matrices ({rawTables.length})
              </summary>
              <div className="table-wrap mt">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Table ID</th>
                      <th>Coefficients</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th>Mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawTables.map(([id, t]) => (
                      <tr key={id}>
                        <td><code>Table {id}</code></td>
                        <td>{t.coefficient_count || 64}</td>
                        <td>{t.minimum}</td>
                        <td>{t.maximum}</td>
                        <td>{t.mean}</td>
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
            <p>
              Compression analysis has not completed for this file.
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
        Compression characteristics reflect camera encoder settings, mobile compression quality, and transmission pathways. Do not infer manipulation from compression characteristics alone.
      </p>
    </div>
  );
}
