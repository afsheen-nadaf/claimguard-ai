import Icon from "./Icon";

const BADGES = {
  pass: { tone: "success", icon: "checkCircle", text: "Passed" },
  review: { tone: "warning", icon: "alert", text: "Review required" },
  inconclusive: { tone: "neutral", icon: "info", text: "Inconclusive" },
  skipped: { tone: "neutral", icon: "info", text: "Skipped" },
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

  const styles = {
    info: "bg-purple-950/40 border-purple-700/50 text-purple-100 mb-6",
    success: "bg-emerald-950/40 border-emerald-700/50 text-emerald-100 mb-6",
    warning: "bg-amber-950/40 border-amber-700/50 text-amber-100 mb-6",
    danger: "bg-red-950/40 border-red-700/50 text-red-100 mb-6",
  };

  const iconColors = {
    info: "text-purple-400",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  return (
    <div
      className={`flex items-start gap-4 p-5 rounded-xl border ${styles[tone]} text-sm leading-relaxed`}
      role={role || (tone === "danger" ? "alert" : "status")}
    >
      <Icon name={icon || defaults[tone]} size={20} className={`flex-shrink-0 mt-0.5 ${iconColors[tone]}`} />
      <div className="flex-1 min-w-0 space-y-2">{children}</div>
      {onDismiss && (
        <button
          type="button"
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss message"
          onClick={onDismiss}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

// Implementation notes for developers. Rendered only by the dev server,
// never in a production build.
export function DevNote({ children }) {
  if (!import.meta.env.DEV) return null;
  return <Callout tone="info"><strong>Dev note.</strong> {children}</Callout>;
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
    <section className={`bg-gradient-to-br from-[#1a1425] to-[#251d33] border border-purple-700/30 rounded-2xl p-8 shadow-xl ${className}`} {...rest}>
      {(title || actions) && (
        <div className="flex items-start gap-4 mb-6">
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-700/30 flex items-center justify-center flex-shrink-0">
              <Icon name={icon} size={20} className="text-purple-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && <h2 className="text-xl font-bold text-white mb-1">{title}</h2>}
            {description && <p className="text-sm text-purple-200">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon = "file", title, children, action }) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-16 px-8 border-2 border-dashed border-purple-700 rounded-2xl bg-purple-950/40">
      <div className="w-16 h-16 rounded-2xl bg-purple-900/30 flex items-center justify-center">
        <Icon name={icon} size={28} className="text-purple-400" />
      </div>
      <strong className="text-lg font-semibold text-white">{title}</strong>
      {children && <p className="text-sm text-purple-200 max-w-md leading-relaxed">{children}</p>}
      {action}
    </div>
  );
}

export function KeyValueList({ items }) {
  return (
    <dl className="space-y-4">
      {items.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[140px,1fr] gap-4 py-3 border-b border-purple-800/30 last:border-0">
          <dt className="text-xs font-semibold uppercase tracking-wider text-purple-400">{label}</dt>
          <dd className="text-sm font-medium text-white break-words">
            {value === null || value === undefined || value === "" ? "—" : value}
          </dd>
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
