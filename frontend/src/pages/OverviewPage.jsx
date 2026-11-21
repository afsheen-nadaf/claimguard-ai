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
  return (
    <>
      <PageHeader
        eyebrow="OVERVIEW"
        title="Claims screening workspace"
        description="Screen insurance claims for policy-rule, duplicate and amount-range indicators, with every result explained for a human reviewer."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate("/new")}>
            <Icon name="filePlus" size={17} /> Submit a new claim
          </button>
        }
      />

      <ol className="flow" aria-label="Screening workflow">
        {FLOW.map(([title, sub], i) => (
          <li key={title}>
            <span className="flow-num">{i + 1}</span>
            <div><strong>{title}</strong><span>{sub}</span></div>
          </li>
        ))}
      </ol>

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
            <ul className="recent-list">
              {recent.map((r) => {
                const s = summarize(r.checks);
                return (
                  <li key={r.id}>
                    <button type="button" className="recent-row" onClick={() => navigate(`/results/${encodeURIComponent(r.id)}`)}>
                      <span className="recent-main">
                        <strong>{r.claim.policyNumber}</strong>
                        <span className="muted small">{r.claim.claimType} · {formatINR(r.claim.claimAmountINR)} · {formatDateTime(r.submittedAt)}</span>
                      </span>
                      <OutcomeBadge summary={s} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Screening checks" icon="layers" description="What runs on every claim.">
          <ul className="capability-list">
            {CAPABILITIES.map((c) => (
              <li key={c.name}>
                <div className="cap-icon"><Icon name={c.icon} size={17} /></div>
                <div className="cap-text"><strong>{c.name}</strong><span>{c.note}</span></div>
                <span className="badge badge-success">Active</span>
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
