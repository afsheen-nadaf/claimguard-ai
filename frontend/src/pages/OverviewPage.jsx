import Icon from "../components/Icon";
import { Card, EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { formatDateTime, formatINR } from "../lib/format";
import { summarize } from "../lib/screening";

const CAPABILITIES = [
  { icon: "clipboard", name: "Policy validation", note: "Deterministic rules checked against the policy record.", status: "integrated" },
  { icon: "copy", name: "Duplicate-claim detection", note: "Compares against reference claims and earlier submissions, and registers the claim.", status: "integrated" },
  { icon: "sliders", name: "Claim-amount outlier detection", note: "Robust statistical range check per claim type.", status: "integrated" },
  { icon: "upload", name: "Document upload", note: "Direct-to-S3 upload via presigned URLs. Contents are not analysed.", status: "integrated" },
  { icon: "history", name: "Stored claim history", note: "No API for listing stored claims is connected.", status: "missing" },
  { icon: "chart", name: "Aggregate analytics", note: "Depends on stored history. Not connected.", status: "missing" },
  { icon: "image", name: "Document forensics (OCR, tampering, signatures)", note: "Not implemented.", status: "missing" },
];

const FLOW = [
  ["Enter claim", "Policy, type, date, amount"],
  ["Upload documents", "PDF, JPG, PNG to private S3"],
  ["Run 3 checks", "Policy, duplicate, amount range"],
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
          description="Session only: claims screened in this browser tab."
          actions={records.length > 0 && <button type="button" className="link-button" onClick={() => navigate("/history")}>View all</button>}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon="history"
              title="No claims screened in this session"
              action={<button type="button" className="btn btn-secondary" onClick={() => navigate("/new")}>Screen a claim</button>}
            >
              A history API is not connected, so only claims you screen here appear, and they clear on refresh.
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

        <Card title="Screening capabilities" icon="layers" description="What is built, and what is not.">
          <ul className="capability-list">
            {CAPABILITIES.map((c) => (
              <li key={c.name}>
                <div className="cap-icon"><Icon name={c.icon} size={17} /></div>
                <div className="cap-text"><strong>{c.name}</strong><span>{c.note}</span></div>
                <span className={`badge ${c.status === "integrated" ? "badge-success" : "badge-neutral"}`}>
                  {c.status === "integrated" ? "Integrated" : "Not available"}
                </span>
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
