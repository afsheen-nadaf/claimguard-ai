import Icon from "./Icon";

export default function RiskScoreMeter({ score }) {
  const level = score <= 30 ? "low" : score <= 60 ? "medium" : "high";
  const config = {
    low: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", label: "Low Risk", icon: "checkCircle" },
    medium: { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", label: "Review", icon: "alert" },
    high: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", label: "High Risk", icon: "xCircle" }
  };
  const { color, bg, label, icon } = config[level];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="risk-meter">
      <svg className="risk-meter-svg" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(147, 51, 234, 0.2)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="risk-meter-content">
        <div className="risk-score" style={{ color }}>{score}</div>
        <div className="risk-label">
          <Icon name={icon} size={15} />
          <span style={{ fontSize: '11px' }}>{label}</span>
        </div>
      </div>
    </div>
  );
}
