import Icon from "../Icon";
import { ProgressBar } from "../ui";
import { fileKind, formatBytes } from "../../lib/format";

function statusText(entry) {
  switch (entry.status) {
    case "uploading": return `Uploading… ${Math.round(entry.progress * 100)}%`;
    case "done": return "Uploaded";
    case "error": return "Upload failed";
    default: return "Ready to upload";
  }
}

function extractionText(entry) {
  if (!entry.extractionStatus || entry.extractionStatus === "pending") {
    return null;
  }
  switch (entry.extractionStatus) {
    case "extracting":
      return "Extracting fields…";
    case "extracted": {
      const filled = entry.extractedFields || [];
      const skipped = entry.skippedFields || [];
      if (filled.length > 0) {
        return `Extracted ${filled.length} field${filled.length === 1 ? "" : "s"}`;
      }
      if (skipped.length > 0) {
        return `No new fields (${skipped.length} already filled)`;
      }
      return "No fields extracted";
    }
    case "failed":
      return "Extraction failed";
    default:
      return null;
  }
}

export default function FileList({ files, onRemove, locked = false }) {
  return (
    <ul className="file-list">
      {files.map((entry) => {
        const kind = fileKind(entry.file);
        const extraction = extractionText(entry);
        return (
          <li key={entry.id} className={`file-row file-${entry.status}`}>
            <div className="file-icon"><Icon name={kind === "PDF" ? "file" : "image"} size={20} /></div>
            <div className="file-meta">
              <strong title={entry.file.name}>{entry.file.name}</strong>
              <span>{kind} · {formatBytes(entry.file.size)} · <span className={`file-status file-status-${entry.status}`}>{statusText(entry)}</span></span>
              {entry.status === "uploading" && <ProgressBar value={entry.progress} label={`Uploading ${entry.file.name}`} />}
              {entry.status === "error" && <span className="file-error">{entry.error}</span>}
              {extraction && (
                <span className={`file-extraction extraction-${entry.extractionStatus}`}>
                  {entry.extractionStatus === "extracting" && <span className="spinner spinner-sm" aria-hidden="true" />}
                  {extraction}
                </span>
              )}
              {entry.extractionStatus === "failed" && entry.extractionError && (
                <span className="file-error">{entry.extractionError}</span>
              )}
            </div>
            {entry.status === "done" && <Icon name="checkCircle" size={19} className="file-done" />}
            {onRemove && (
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Remove ${entry.file.name}`}
                disabled={locked}
                onClick={() => onRemove(entry.id)}
              >
                <Icon name="trash" size={17} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}