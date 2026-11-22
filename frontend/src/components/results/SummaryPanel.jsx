import Icon from "../Icon";
import { Spinner, StatusBadge } from "../ui";
import { CHECKS } from "../../lib/checks";
import { CHECK_ORDER, getChecksNeedingAttention } from "../../lib/screening";

const TONE_ICON = { info: "clock", success: "checkCircle", warning: "alert", danger: "xCircle" };

function reasonFor(key, check) {
  if (!check || check.status === "running" || check.status === "idle") return { state: "running", text: "Running…" };
  if (check.status === "error") return { state: "error", text: check.error || "Check failed" };
  const r = check.result;
  if (!r) return { state: "inconclusive", text: "No result" };
  if (key === "policy") {
    const flagText = r.flags?.length ? `: ${r.flags.map((f) => f.text).join("; ")}` : "";
    return { state: r.state, text: `${r.label}${r.state === "review" ? flagText : ""}` };
  }
  if (key === "duplicate") {
    const parts = [];
    if (r.matches?.length) {
      parts.push(`${r.matches.length} claim record match${r.matches.length === 1 ? "" : "es"}`);
    }
    if (r.imageMatches?.length) {
      parts.push(`${r.imageMatches.length} visual image match${r.imageMatches.length === 1 ? "" : "es"}`);
    }
    const matchDetail = parts.length ? ` (${parts.join(", ")})` : "";
    return { state: r.state, text: `${r.label}${matchDetail}` };
  }
  return { state: r.state, text: r.label };
}

const STATE_ICON = { pass: "checkCircle", review: "alert", inconclusive: "info", skipped: "info", error: "xCircle", running: "clock" };

export default function SummaryPanel({ summary, checks }) {
  const { counts } = summary;
  const attentionKeys = getChecksNeedingAttention(checks);
  return (
    <section className={`card summary-panel summary-${summary.tone}`} aria-live="polite" aria-labelledby="summary-title">
      <div className="summary-head">
        <div className={`summary-icon tone-${summary.tone}`}>
          {summary.key === "progress" ? <span className="spinner" aria-hidden="true" /> : <Icon name={TONE_ICON[summary.tone]} size={26} />}
        </div>
        <div>
          <div className="eyebrow">OVERALL SCREENING SUMMARY</div>
          <h2 id="summary-title">{summary.title}</h2>
          <p className="summary-text">{summary.text}</p>
        </div>
      </div>

      <dl className="count-row">
        <div className="count count-pass"><dt>Passed</dt><dd>{counts.passed}</dd></div>
        <div className="count count-review"><dt>Need review</dt><dd>{counts.review}</dd></div>
        <div className="count count-fail"><dt>Failed or incomplete</dt><dd>{counts.incomplete}</dd></div>
        {counts.skipped > 0 && <div className="count count-skipped"><dt>Skipped (not passed)</dt><dd>{counts.skipped}</dd></div>}
        {counts.pending > 0 && <div className="count count-pending"><dt>Running</dt><dd>{counts.pending}</dd></div>}
      </dl>

      <section className="triage-panel" aria-labelledby="triage-title">
        <div className="triage-heading">
          <div>
            <div className="eyebrow">RESULTS TRIAGE</div>
            <h3 id="triage-title">{attentionKeys.length ? "Priority review" : "Review queue"}</h3>
          </div>
          {attentionKeys.length > 0 && <span className="triage-count">{attentionKeys.length} item{attentionKeys.length === 1 ? "" : "s"}</span>}
        </div>

        {attentionKeys.length > 0 ? (
          <>
            <ul className="triage-list">
              {attentionKeys.map((key) => {
                const check = checks[key];
                const reason = reasonFor(key, check);
                const state = check.status === "error" ? "error" : check.result?.state;
                return (
                  <li key={key}>
                    <a className="triage-item" href={`#check-${key}`} aria-label={`Review ${CHECKS[key].title}: ${reason.text}`}>
                      <span className={`triage-icon triage-icon-${state}`}><Icon name={STATE_ICON[state] || "info"} size={17} /></span>
                      <span className="triage-copy">
                        <strong>{CHECKS[key].title}</strong>
                        <span>{reason.text}</span>
                      </span>
                      <StatusBadge state={state} />
                      <Icon name="arrow" size={16} className="triage-arrow" />
                    </a>
                  </li>
                );
              })}
            </ul>
            {counts.pending > 0 && <p className="muted small">{counts.pending} other check{counts.pending === 1 ? " is" : "s are"} still running.</p>}
          </>
        ) : counts.pending > 0 ? (
          <div className="triage-empty triage-pending">
            <Spinner label="" />
            <p>No review flags have appeared yet. {counts.pending} check{counts.pending === 1 ? " is" : "s are"} still running.</p>
          </div>
        ) : (
          <div className="triage-empty">
            <Icon name={counts.skipped > 0 ? "info" : "checkCircle"} size={18} />
            <p>
              {counts.skipped > 0
                ? `All applicable checks passed; ${counts.skipped} check${counts.skipped === 1 ? " was" : "s were"} skipped. This is not a fraud determination.`
                : "All completed checks passed. Continue standard handling; this is not a fraud determination."}
            </p>
          </div>
        )}
      </section>

      <details className="all-check-details">
        <summary>View all six check summaries</summary>
        <ul className="reason-list">
          {CHECK_ORDER.map((key) => {
            const reason = reasonFor(key, checks[key]);
            return (
              <li key={key} className={`reason reason-${reason.state}`}>
                {reason.state === "running" ? <Spinner label="" /> : <Icon name={STATE_ICON[reason.state] || "info"} size={17} />}
                <a href={`#check-${key}`}><strong>{CHECKS[key].title}.</strong> {reason.text}</a>
              </li>
            );
          })}
        </ul>
      </details>

      <div className="next-step">
        <strong>Recommended next step</strong>
        <p>{summary.next}</p>
      </div>
      <p className="muted small">
        This is a screening summary, not a fraud determination. A person decides what happens to the claim.
      </p>
    </section>
  );
}
