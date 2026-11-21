import Icon from "../components/Icon";
import { Card, EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { formatDateTime, formatINR } from "../lib/format";
import { summarize } from "../lib/screening";

const CAPABILITIES = [
  { icon: "clipboard", name: "Policy validation", note: "Deterministic rules checked against the policy record." },
  { icon: "copy", name: "Duplicate-claim detection", note: "Compares claim details and images with earlier claims." },
  { icon: "sliders", name: "Claim-amount outlier detection", note: "Robust statistical range check per claim type." },
  { icon: "image", name: "Image forensics", note: "Metadata, compression and AI-generation signals in photos." },
  { icon: "search", name: "Evidence relevance", note: "Checks that documents and photos match the reported incident." },
  { icon: "layers", name: "Cross-document consistency", note: "Flags mismatched details across uploaded documents." },
];

const FLOW = [
  ["Enter claim", "Policy, type, date, amount"],
  ["Upload documents", "PDF, JPG or PNG, stored privately"],
  ["Automated screening", "Six checks run in parallel"],
  ["Analyst review", "A person makes the decision"],
];

export default function OverviewPage({ records, navigate }) {
  const recent = records.slice(0, 5);

  const stats = {
    total: records.length,
    reviewRequired: records.filter(r => summarize(r.checks).key === "review").length,
    cleared: records.filter(r => summarize(r.checks).key === "clear").length,
    checks: records.length * 6,
  };

  return (
    <>
      <div className="hero-section">
        <div className="hero-content">
          <div className="eyebrow">AI-POWERED FRAUD DETECTION</div>
          <h1 className="hero-title">Claims Screening Workspace</h1>
          <p className="hero-description">
            Multi-layered fraud detection combining rule-based validation,
            statistical analysis, and AI-powered image forensics. Every flag
            is explainable for human review.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate("/new")}>
              <Icon name="filePlus" size={18} /> Screen a Claim
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate("/how")}>
              <Icon name="help" size={18} /> How it Works
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <Icon name="file" size={24} />
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Claims Screened</div>
          </div>
          <div className="stat-card stat-warning">
            <Icon name="alert" size={24} />
            <div className="stat-value">{stats.reviewRequired}</div>
            <div className="stat-label">Flagged for Review</div>
          </div>
          <div className="stat-card stat-success">
            <Icon name="checkCircle" size={24} />
            <div className="stat-value">{stats.cleared}</div>
            <div className="stat-label">Cleared</div>
          </div>
          <div className="stat-card">
            <Icon name="layers" size={24} />
            <div className="stat-value">{stats.checks}</div>
            <div className="stat-label">Checks Completed</div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <Card
          title="Recent submissions"
          icon="history"
          description="Claims you have screened in this session."
          actions={records.length > 0 && <button type="button" className="link-button" onClick={() => navigate("/history")}>View all</button>}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon="history"
              title="No claims screened yet"
              action={<button type="button" className="btn btn-secondary" onClick={() => navigate("/new")}>Screen a claim</button>}
            >
              Claims you screen will show up here with their outcome.
            </EmptyState>
          ) : (
            <ul className="recent-list-compact">
              {recent.map((r) => {
                const s = summarize(r.checks);
                return (
                  <li key={r.id}>
                    <button type="button" className="recent-row-compact" onClick={() => navigate(`/results/${encodeURIComponent(r.id)}`)}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: "13px" }}>
                        <strong>{r.claim.policyNumber}</strong>
                        <span className="muted small" style={{ display: "block", fontSize: "11px" }}>{r.claim.claimType} · {formatINR(r.claim.claimAmountINR)}</span>
                      </span>
                      <OutcomeBadge summary={s} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Screening checks" icon="layers" description="Active detection modules">
          <ul className="capability-list-compact">
            {CAPABILITIES.map((c) => (
              <li key={c.name}>
                <div className="cap-icon-sm"><Icon name={c.icon} size={14} /></div>
                <div className="cap-text-sm">
                  <strong>{c.name}</strong>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export function OutcomeBadge({ summary }) {
  const map = { clear: "pass", review: "review", partial: "inconclusive", failed: "error", progress: "running" };
  return <StatusBadge state={map[summary.key]} label={summary.title} />;
}
