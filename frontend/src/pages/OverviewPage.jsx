import Icon from "../components/Icon";
import { Card, EmptyState, StatusBadge } from "../components/ui";
import { formatDateTime, formatINR } from "../lib/format";
import { CHECKS } from "../lib/checks";
import {
  CHECK_ORDER,
  getChecksNeedingAttention,
  normalizeSkippedForensics,
  summarizeRecord,
} from "../lib/screening";

const CAPABILITIES = [
  { icon: "clipboard", name: "Policy validation", note: "Deterministic rules checked against the policy record." },
  { icon: "copy", name: "Duplicate-claim detection", note: "Compares claim details and images with earlier claims." },
  { icon: "sliders", name: "Claim-amount outlier detection", note: "Robust statistical range check per claim type." },
  { icon: "image", name: "Image forensics", note: "Metadata, compression and AI-generation signals in photos." },
  { icon: "search", name: "Evidence relevance", note: "Checks that documents and photos match the reported incident." },
  { icon: "layers", name: "Document & image consistency", note: "Compares extracted document details and checks photos for visual consistency." },
];

export default function OverviewPage({ records, navigate }) {
  const recent = records.slice(0, 5);
  const summaries = records.map((record) => ({ record, summary: summarizeRecord(record) }));

  const stats = {
    total: records.length,
    reviewRequired: summaries.filter(({ summary }) => summary.key === "review").length,
    cleared: summaries.filter(
      ({ summary }) => summary.key === "clear" && summary.counts.skipped === 0
    ).length,
    checks: records.reduce(
      (total, record) => {
        const checks = normalizeSkippedForensics(record);
        return (
          total +
          CHECK_ORDER.filter(
            (key) =>
              checks[key]?.status === "done" &&
              checks[key]?.result?.state !== "skipped"
          ).length
        );
      },
      0
    ),
  };

  const attentionRecords = records
    .map((record) => {
      const summary = summarizeRecord(record);
      const missingEvidence =
        summary.key !== "unavailable" &&
        Array.isArray(record.documents) &&
        record.documents.length === 0;
      const attentionChecks = getChecksNeedingAttention(record.checks);
      const attentionRank = {
        review: 0,
        failed: 1,
        partial: 2,
        evidence: 3,
        unavailable: 4,
      }[summary.key === "clear" && missingEvidence ? "evidence" : summary.key];

      return {
        record,
        summary,
        missingEvidence,
        attentionChecks,
        attentionRank,
      };
    })
    .filter(({ summary, missingEvidence }) =>
      ["review", "partial", "failed", "unavailable"].includes(summary.key) ||
      missingEvidence
    )
    .sort((a, b) =>
      a.attentionRank - b.attentionRank ||
      Number(b.record.submittedAt) - Number(a.record.submittedAt)
    )
    .slice(0, 5);

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
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate("/history")}>
              <Icon name="history" size={18} /> Review Claims
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate("/analytics")}>
              <Icon name="chart" size={18} /> View Analytics
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <Icon name="file" size={24} />
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Claims in History</div>
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

      <div className="mt">
        <Card
          title="Attention queue"
          icon="alert"
          description="Claims that need an adjuster's review or have incomplete screening details."
          actions={attentionRecords.length > 0 && (
            <button type="button" className="link-button" onClick={() => navigate("/history")}>
              View history
            </button>
          )}
        >
          {attentionRecords.length === 0 ? (
            <div className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl border border-emerald-800/30 bg-emerald-950/20">
              <span className="flex items-center gap-3 text-sm text-emerald-200">
                <Icon name="checkCircle" size={18} className="text-emerald-400" />
                No claims currently need follow-up.
              </span>
              <button type="button" className="link-button" onClick={() => navigate("/history")}>
                Open claim history
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {attentionRecords.map((item) => {
                const { record, summary, missingEvidence, attentionChecks } = item;
                const displayTitle =
                  record.claim?.claimantName ||
                  record.claim?.policyNumber ||
                  `Claim #${record.id}`;
                const reasons = [
                  summary.key === "unavailable"
                    ? "Detailed screening results were not recorded for this legacy entry."
                    : attentionChecks.length > 0
                      ? `Flagged: ${attentionChecks.map((key) => CHECKS[key].title).join(", ")}`
                      : null,
                  missingEvidence ? "No supporting files attached" : null,
                ].filter(Boolean);

                return (
                  <li
                    key={record.id}
                    className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl border border-purple-800/30 bg-purple-950/20"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon
                        name={summary.key === "unavailable" ? "info" : "alert"}
                        size={18}
                        className={summary.key === "unavailable" ? "text-purple-300 mt-0.5" : "text-amber-400 mt-0.5"}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm text-white">{displayTitle}</strong>
                          <code className="px-2 py-0.5 bg-purple-950/80 border border-purple-800/60 rounded text-[11px] text-purple-200">
                            {record.id}
                          </code>
                          <StatusBadge
                            state={summary.key === "unavailable" ? "idle" : missingEvidence && summary.key === "clear" ? "review" : ({ review: "review", partial: "inconclusive", failed: "error" }[summary.key] || "idle")}
                            label={summary.key === "unavailable" ? "Results unavailable" : missingEvidence && summary.key === "clear" ? "Evidence missing" : summary.title}
                          />
                        </div>
                        <p className="text-xs text-purple-200 mt-1">
                          Policy: <strong>{record.claim?.policyNumber || "—"}</strong>
                          {" · "}
                          {record.claim?.claimType || "General"}
                          {record.claim?.claimAmountINR != null && (
                            <> · {formatINR(record.claim.claimAmountINR)}</>
                          )}
                          {" · "}
                          Submitted {formatDateTime(record.submittedAt)}
                        </p>
                        {reasons.length > 0 && (
                          <p className="text-xs text-purple-400 mt-0.5">
                            {reasons.join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 bg-[#251d33] text-purple-100 border border-purple-700/30 rounded-lg text-sm font-semibold hover:bg-[#2d2440] transition-all"
                      onClick={() =>
                        navigate(
                          summary.key === "unavailable"
                            ? "/history"
                            : `/results/${encodeURIComponent(record.id)}`
                        )
                      }
                    >
                      {summary.key === "unavailable" ? "Open history" : "Review claim"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="two-col mt">
        <Card
          title="Recent submissions"
          icon="history"
          description="Most recently saved claim records."
          actions={records.length > 0 && <button type="button" className="link-button" onClick={() => navigate("/history")}>View all</button>}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon="history"
              title="No claims in queue yet"
              action={<button type="button" className="btn btn-secondary" onClick={() => navigate("/history")}>Open claims</button>}
            >
              Submitted claims will show up here with their screening outcome.
            </EmptyState>
          ) : (
            <ul className="recent-list-compact">
              {recent.map((r) => {
                const s = summarizeRecord(r);
                const primaryLabel = r.claim?.claimantName || r.claim?.policyNumber || r.id;
                return (
                  <li key={r.id}>
                    <button type="button" className="recent-row-compact" onClick={() => navigate(`/results/${encodeURIComponent(r.id)}`)}>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex items-center gap-2 flex-wrap">
                          <strong className="text-[13px] text-white">{primaryLabel}</strong>
                          <code className="px-1.5 py-0.5 bg-purple-950/80 border border-purple-800/50 rounded text-[10px] text-purple-300">
                            {r.id}
                          </code>
                        </span>
                        <span className="block text-[11px] text-purple-300 mt-0.5">
                          Policy: {r.claim?.policyNumber || "—"} · {r.claim?.claimType || "General"} · {formatINR(r.claim?.claimAmountINR)} · {formatDateTime(r.submittedAt)}
                        </span>
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
  const map = { clear: "pass", review: "review", partial: "inconclusive", failed: "error", progress: "running", unavailable: "idle" };
  const state =
    summary.key === "clear" && summary.counts.skipped > 0
      ? "inconclusive"
      : map[summary.key];
  return <StatusBadge state={state} label={summary.title} />;
}