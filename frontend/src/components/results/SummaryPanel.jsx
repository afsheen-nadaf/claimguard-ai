import Icon from "../Icon";
import { Spinner } from "../ui";
import { CHECKS } from "../../lib/checks";
import { CHECK_ORDER } from "../../lib/screening";

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

const STATE_ICON = { pass: "checkCircle", review: "alert", inconclusive: "info", error: "xCircle", running: "clock" };

export default function SummaryPanel({ summary, checks }) {
  const { counts } = summary;
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
        {counts.pending > 0 && <div className="count count-pending"><dt>Running</dt><dd>{counts.pending}</dd></div>}
      </dl>

      <ul className="reason-list">
        {CHECK_ORDER.map((key) => {
          const reason = reasonFor(key, checks[key]);
          return (
            <li key={key} className={`reason reason-${reason.state}`}>
              {reason.state === "running" ? <Spinner label="" /> : <Icon name={STATE_ICON[reason.state] || "info"} size={17} />}
              <span><strong>{CHECKS[key].title}.</strong> {reason.text}</span>
            </li>
          );
        })}
      </ul>

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
