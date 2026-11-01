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

export default function FileList({ files, onRemove, locked = false }) {
  return (
    <ul className="file-list">
      {files.map((entry) => {
        const kind = fileKind(entry.file);
        return (
          <li key={entry.id} className={`file-row file-${entry.status}`}>
            <div className="file-icon"><Icon name={kind === "PDF" ? "file" : "image"} size={20} /></div>
            <div className="file-meta">
              <strong title={entry.file.name}>{entry.file.name}</strong>
              <span>{kind} · {formatBytes(entry.file.size)} · <span className={`file-status file-status-${entry.status}`}>{statusText(entry)}</span></span>
              {entry.status === "uploading" && <ProgressBar value={entry.progress} label={`Uploading ${entry.file.name}`} />}
              {entry.status === "error" && <span className="file-error">{entry.error}</span>}
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
