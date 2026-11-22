import { useState } from "react";
import Icon from "./Icon";

export default function CompactCheckCard({ check, title, icon, children, badgeLabel }) {
  const [expanded, setExpanded] = useState(false);

  const statusMap = {
    pass: { icon: "checkCircle", label: badgeLabel || "Passed", color: "pass" },
    review: { icon: "alert", label: badgeLabel || "Review Required", color: "review" },
    error: { icon: "xCircle", label: "Error", color: "error" },
    inconclusive: { icon: "info", label: "Inconclusive", color: "review" },
  };

  const status = check.status === "done" ? statusMap[check.result?.state] || statusMap.inconclusive :
                 check.status === "error" ? statusMap.error :
                 { icon: "clock", label: "Running", color: "pass" };

  return (
    <div className="check-card-compact">
      <div className="check-card-header">
        <div className="check-icon-compact">
          <Icon name={icon} size={16} />
        </div>
        <h4>{title}</h4>
      </div>

      <div className={`check-status-compact status-${status.color}`}>
        <Icon name={status.icon} size={14} />
        <span>{status.label}</span>
      </div>

      {check.status === "done" && check.result?.label && (
        <p className="check-detail-compact">{check.result.label}</p>
      )}

      {check.status === "done" && children && (
        <>
          <button
            type="button"
            className="check-expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide details" : "Show details"}
            <Icon name="chevronDown" size={12} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {expanded && (
            <div className="check-full-details">
              {children}
            </div>
          )}
        </>
      )}
    </div>
  );
}
