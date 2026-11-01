import { useRef, useState } from "react";
import Icon from "../Icon";
import { Callout, Card, EmptyState } from "../ui";
import FileList from "./FileList";

export default function DocumentsStep({ draft, onBack, onContinue }) {
  const { files, fileMessages, addFiles, removeFile } = draft;
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [needFile, setNeedFile] = useState(false);

  function handleFiles(list) {
    setNeedFile(false);
    addFiles(list);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleContinue() {
    if (files.length === 0) {
      setNeedFile(true);
      return;
    }
    onContinue();
  }

  return (
    <Card
      title="Supporting documents"
      icon="upload"
      description="Attach forms, invoices, reports or photos. Files are uploaded when you submit the claim."
    >
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          tabIndex={-1}
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="dropzone-icon"><Icon name="cloud" size={34} /></div>
        <strong>Drag and drop files here</strong>
        <span className="muted">or</span>
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
          Browse files
        </button>
        <p className="dropzone-rules">PDF, JPG, JPEG or PNG · up to 10 MB per file</p>
      </div>

      <div className="stack-sm" aria-live="polite">
        {needFile && <Callout tone="danger">Add at least one supporting document to continue.</Callout>}
        {fileMessages.map((m, i) => (
          <Callout key={i} tone={m.tone === "error" ? "danger" : "success"}>{m.text}</Callout>
        ))}
      </div>

      <div className="section-label">
        <strong>Selected files</strong>
        <span className="count-pill">{files.length}</span>
      </div>
      {files.length ? (
        <FileList files={files} onRemove={removeFile} />
      ) : (
        <EmptyState icon="file" title="No files selected yet">
          Added documents will be listed here with their type and size.
        </EmptyState>
      )}

      <div className="form-footer">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <Icon name="arrowLeft" size={17} /> Back to details
        </button>
        <button type="button" className="btn btn-primary" onClick={handleContinue}>
          Review claim <Icon name="arrow" size={17} />
        </button>
      </div>
    </Card>
  );
}
