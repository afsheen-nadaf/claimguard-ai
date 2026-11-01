import Icon from "./Icon";

const BADGES = {
  pass: { tone: "success", icon: "checkCircle", text: "Passed" },
  review: { tone: "warning", icon: "alert", text: "Review required" },
  inconclusive: { tone: "neutral", icon: "info", text: "Inconclusive" },
  error: { tone: "danger", icon: "xCircle", text: "Check failed" },
  running: { tone: "info", icon: "clock", text: "Running" },
  idle: { tone: "neutral", icon: "clock", text: "Pending" },
};

export function StatusBadge({ state, label }) {
  const badge = BADGES[state] || BADGES.idle;
  return (
    <span className={`badge badge-${badge.tone}`}>
      {state === "running" ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Icon name={badge.icon} size={14} />}
      {label || badge.text}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <span className="spinner-row" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Callout({ tone = "info", icon, children, onDismiss, role }) {
  const defaults = { info: "info", success: "checkCircle", warning: "alert", danger: "xCircle" };
  return (
    <div className={`callout callout-${tone}`} role={role || (tone === "danger" ? "alert" : "status")}>
      <Icon name={icon || defaults[tone]} size={18} />
      <div className="callout-body">{children}</div>
      {onDismiss && (
        <button type="button" className="icon-button" aria-label="Dismiss message" onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, icon, description, actions, children, className = "", ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || actions) && (
        <div className="card-header">
          {icon && <div className="card-icon"><Icon name={icon} size={20} /></div>}
          <div className="card-title-wrap">
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="card-description">{description}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon = "file", title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function KeyValueList({ items }) {
  return (
    <dl className="kv-list">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressBar({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
