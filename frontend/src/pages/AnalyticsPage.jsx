import { Callout, Card, EmptyState, PageHeader } from "../components/ui";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER, summarize } from "../lib/screening";

const OUTCOMES = [
  ["clear", "No indicators found", "bar-success"],
  ["review", "Review required", "bar-warning"],
  ["partial", "Partially screened", "bar-neutral"],
  ["failed", "Screening failed", "bar-danger"],
];

export default function AnalyticsPage({ records, navigate }) {
  const summaries = records.map((r) => summarize(r.checks));
  const finished = summaries.filter((s) => s.key !== "progress");
  const byOutcome = Object.fromEntries(OUTCOMES.map(([key]) => [key, finished.filter((s) => s.key === key).length]));

  const perCheck = CHECK_ORDER.map((key) => {
    const rows = records.map((r) => r.checks[key]).filter((c) => c.status === "done" || c.status === "error");
    return {
      key,
      total: rows.length,
      pass: rows.filter((c) => c.status === "done" && c.result?.state === "pass").length,
      review: rows.filter((c) => c.status === "done" && c.result?.state === "review").length,
      incomplete: rows.filter((c) => c.status === "error" || c.result?.state === "inconclusive").length,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS"
        title="Analytics"
        description="Outcome breakdown for claims screened in this session."
      />
      <Callout tone="info">
        <strong>Aggregate analytics are not connected.</strong> The frontend has no API for stored claims, so nothing here reflects the backend database. The figures below only count claims screened in this browser tab and reset on refresh.
      </Callout>

      {records.length === 0 ? (
        <Card className="mt">
          <EmptyState
            icon="chart"
            title="No data to chart yet"
            action={<button type="button" className="btn btn-primary" onClick={() => navigate("/new")}>Submit a new claim</button>}
          >
            Screen one or more claims and this page will summarise their outcomes.
          </EmptyState>
        </Card>
      ) : (
        <div className="two-col mt">
          <Card title="Outcomes this session" icon="chart" description={`${finished.length} claim${finished.length === 1 ? "" : "s"} with finished screening`}>
            <ul className="bars">
              {OUTCOMES.map(([key, label, tone]) => {
                const count = byOutcome[key];
                const pct = finished.length ? (count / finished.length) * 100 : 0;
                return (
                  <li key={key}>
                    <div className="bar-head"><span>{label}</span><strong>{count}</strong></div>
                    <div className="bar-track" aria-hidden="true"><div className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Results by check" icon="layers" description="How each check came out, session only.">
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Check</th><th className="num">Passed</th><th className="num">Review</th><th className="num">Incomplete</th></tr></thead>
                <tbody>
                  {perCheck.map((row) => (
                    <tr key={row.key}>
                      <td>{CHECKS[row.key].title}</td>
                      <td className="num">{row.pass}</td>
                      <td className="num">{row.review}</td>
                      <td className="num">{row.incomplete}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
