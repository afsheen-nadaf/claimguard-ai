import Icon from "../Icon";
import { Callout, Spinner, StatusBadge } from "../ui";

// Shared frame for one screening check: header + badge, then a body that
// depends on whether the check is running, failed, or finished.
export default function CheckCard({ title, icon, check, badgeLabel, onRetry, wide = false, children }) {
  const state = check.status === "done" ? check.result?.state || "inconclusive" : check.status;
  const rawText = check.raw != null ? JSON.stringify(check.raw, null, 2) : null;

  return (
    <section className={`card check-card tone-${state} ${wide ? "wide" : ""}`} aria-busy={check.status === "running"}>
      <div className="card-header">
        <div className="card-icon"><Icon name={icon} size={20} /></div>
        <div className="card-title-wrap"><h3 className="card-title">{title}</h3></div>
        <StatusBadge state={state} label={check.status === "done" ? badgeLabel : undefined} />
      </div>

      {check.status === "running" && (
        <div className="check-loading"><Spinner label="Running check…" /></div>
      )}

      {check.status === "idle" && <p className="muted">Waiting to start.</p>}

      {check.status === "error" && (
        <>
          <Callout tone="danger">
            <strong>This check could not be completed.</strong>
            <p>{check.error}</p>
            <p>It has not been counted as a pass.</p>
          </Callout>
          <div className="check-actions">
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              <Icon name="refresh" size={16} /> Retry check
            </button>
          </div>
        </>
      )}

      {check.status === "done" && check.result && <div className="check-body">{children}</div>}

      {rawText && (
        <details className="raw-details">
          <summary><Icon name="chevron" size={15} /> Raw API response</summary>
          <pre>{rawText}</pre>
        </details>
      )}
    </section>
  );
}
