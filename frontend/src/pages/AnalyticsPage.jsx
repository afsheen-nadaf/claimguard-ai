import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Callout, Card, EmptyState, PageHeader } from "../components/ui";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER, calculateRiskScore, summarize } from "../lib/screening";

const OUTCOMES = [
  ["clear", "No indicators found", "#22c55e"],
  ["review", "Review required", "#fbbf24"],
  ["partial", "Partially screened", "#9ca3af"],
  ["failed", "Screening failed", "#ef4444"],
];

const CHART_COLORS = {
  pass: "#22c55e",
  review: "#fbbf24",
  incomplete: "#9ca3af",
};

export default function AnalyticsPage({ records, navigate }) {
  const summaries = records.map((r) => summarize(r.checks));
  const finished = summaries.filter((s) => s.key !== "progress");
  const byOutcome = Object.fromEntries(OUTCOMES.map(([key]) => [key, finished.filter((s) => s.key === key).length]));

  const perCheck = CHECK_ORDER.map((key) => {
    const rows = records.map((r) => r.checks[key]).filter((c) => c.status === "done" || c.status === "error");
    return {
      key,
      name: CHECKS[key].title,
      pass: rows.filter((c) => c.status === "done" && c.result?.state === "pass").length,
      review: rows.filter((c) => c.status === "done" && c.result?.state === "review").length,
      incomplete: rows.filter((c) => c.status === "error" || c.result?.state === "inconclusive").length,
    };
  });

  const pieData = OUTCOMES.map(([key, label, color]) => ({
    name: label,
    value: byOutcome[key],
    color,
  })).filter(d => d.value > 0);

  const riskScores = records.map(r => calculateRiskScore(r.checks)).filter(s => s > 0);
  const avgRiskScore = riskScores.length > 0 ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length) : 0;

  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS"
        title="Analytics Dashboard"
        description="Outcome breakdown and insights from your screening sessions."
      />
      <Callout tone="info">
        <strong>Session analytics.</strong> These figures cover claims screened in this session only and clear on refresh.
      </Callout>

      {records.length === 0 ? (
        <Card className="mt">
          <EmptyState
            icon="chart"
            title="No data to chart yet"
            action={<button type="button" className="btn btn-primary" onClick={() => navigate("/new")}>Submit a new claim</button>}
          >
            Screen a claim and this page will summarise the outcomes.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="three-col mt">
            <div className="metric-card">
              <div className="metric-label">Total Screened</div>
              <div className="metric-value">{records.length}</div>
            </div>
            <div className="metric-card metric-warning">
              <div className="metric-label">Flagged for Review</div>
              <div className="metric-value">{byOutcome.review}</div>
              <div className="metric-sub">{finished.length > 0 ? Math.round((byOutcome.review / finished.length) * 100) : 0}% of total</div>
            </div>
            <div className="metric-card metric-success">
              <div className="metric-label">Average Risk Score</div>
              <div className="metric-value">{avgRiskScore}</div>
              <div className="metric-sub">out of 100</div>
            </div>
          </div>

          <div className="two-col mt">
            <Card title="Outcomes Distribution" icon="chart" description={`${finished.length} completed screenings`}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#14171a", border: "1px solid #2a2f35", borderRadius: "8px" }}
                      labelStyle={{ color: "#f3f4f6" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted">No completed screenings yet</p>
              )}
            </Card>

            <Card title="Results by Check" icon="layers" description="Detection rates per screening type">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={perCheck}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f35" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={{ background: "#14171a", border: "1px solid #2a2f35", borderRadius: "8px" }}
                    labelStyle={{ color: "#f3f4f6" }}
                  />
                  <Legend />
                  <Bar dataKey="pass" fill={CHART_COLORS.pass} name="Passed" />
                  <Bar dataKey="review" fill={CHART_COLORS.review} name="Review" />
                  <Bar dataKey="incomplete" fill={CHART_COLORS.incomplete} name="Incomplete" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
