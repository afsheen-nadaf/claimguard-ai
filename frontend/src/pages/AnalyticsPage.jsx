import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Callout, Card, EmptyState, PageHeader } from "../components/ui";
import { CHECKS } from "../lib/checks";
import { buildAnalyticsData } from "../lib/analytics";

const OUTCOMES = [
  ["clear", "No review flags", "#22c55e"],
  ["review", "Review required", "#fbbf24"],
  ["partial", "Partially screened", "#9ca3af"],
  ["failed", "Screening failed", "#ef4444"],
];

const CHART_COLORS = {
  pass: "#22c55e",
  review: "#fbbf24",
  incomplete: "#ef4444",
  skipped: "#a78bfa",
};

const CHECK_CHART_LABELS = {
  policy: "Policy validation",
  duplicate: "Duplicate claims",
  outlier: "Claim amount outliers",
  forensics: "Image forensics",
  evidence: "Evidence relevance",
  consistency: "Document consistency",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "rgba(26, 20, 37, 0.96)",
    border: "1px solid rgba(148, 102, 217, 0.35)",
    borderRadius: "10px",
  },
  labelStyle: { color: "#f5f0e8" },
  itemStyle: { color: "#e8dff9" },
};

export default function AnalyticsPage({ records, navigate }) {
  const analytics = buildAnalyticsData(records);
  const {
    completeRecordCount,
    excludedRecordCount,
    finishedRecords,
    byOutcome,
    perCheck,
    avgRiskScore,
    riskDistribution,
    screeningsOverTime,
    outcomesByClaimType,
    claimsWithPhotos,
    photoCoveragePercent,
  } = analytics;

  const pieData = OUTCOMES.map(([key, label, color]) => ({
    name: label,
    value: byOutcome[key],
    color,
  })).filter((item) => item.value > 0);

  const checkData = perCheck.map((item) => ({
    ...item,
    name: CHECK_CHART_LABELS[item.key] || CHECKS[item.key].title,
  }));

  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS"
        title="Analytics Dashboard"
        description="Screening trends and review indicators across saved claim results."
      />
      <Callout tone="info">
        <strong>Screening analytics.</strong> Charts use saved claims with detailed screening results.
        {excludedRecordCount > 0 &&
          ` ${excludedRecordCount} claim-history record${excludedRecordCount === 1 ? " is" : "s are"} missing check details and excluded.`}
      </Callout>

      {finishedRecords.length === 0 ? (
        <Card className="mt">
          <EmptyState
            icon="chart"
            title="No detailed screening data to chart yet"
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/new")}
              >
                Submit a new claim
              </button>
            }
          >
            {records.length > 0
              ? "The available claim-history records do not include screening results. New screenings will appear here."
              : "Screen a claim and this page will summarize outcomes, risk scores, and trends."}
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="three-col mt">
            <div className="metric-card">
              <div className="metric-label">Completed Screenings</div>
              <div className="metric-value">{finishedRecords.length}</div>
            </div>
            <div className="metric-card metric-warning">
              <div className="metric-label">Flagged for Review</div>
              <div className="metric-value">{byOutcome.review}</div>
              <div className="metric-sub">
                {finishedRecords.length > 0
                  ? Math.round((byOutcome.review / finishedRecords.length) * 100)
                  : 0}
                % of completed screenings
              </div>
            </div>
            <div className="metric-card metric-success">
              <div className="metric-label">Average Risk Score</div>
              <div className="metric-value">{avgRiskScore}</div>
              <div className="metric-sub">out of 100 · screening indicator only</div>
            </div>
          </div>

          <div className="two-col mt">
            <Card
              title="Outcome Distribution"
              icon="chart"
              description={`${finishedRecords.length} completed screenings`}
            >
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
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted">No completed outcomes yet.</p>
              )}
            </Card>

            <Card
              title="Results by Check"
              icon="layers"
              description={`${completeRecordCount} claim${completeRecordCount === 1 ? "" : "s"} with data for all checks`}
            >
              <ResponsiveContainer width="100%" height={330}>
                <BarChart
                  data={checkData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(147, 51, 234, 0.2)" />
                  <XAxis
                    type="number"
                    domain={[0, "dataMax"]}
                    allowDecimals={false}
                    tick={{ fill: "#c4b5fd", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={185}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#d5c2f5", fontSize: 10 }}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                  <Bar dataKey="pass" stackId="checks" fill={CHART_COLORS.pass} name="Passed" />
                  <Bar dataKey="review" stackId="checks" fill={CHART_COLORS.review} name="Review required" />
                  <Bar dataKey="incomplete" stackId="checks" fill={CHART_COLORS.incomplete} name="Incomplete" />
                  <Bar dataKey="skipped" stackId="checks" fill={CHART_COLORS.skipped} name="Skipped (not run)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="two-col mt">
            <Card
              title="Screenings Over Time"
              icon="chart"
              description="Completed screenings and claims flagged for review by submission date"
            >
              {screeningsOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={screeningsOverTime} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(147, 51, 234, 0.2)" />
                    <XAxis dataKey="label" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="screened"
                      name="Completed screenings"
                      stroke={CHART_COLORS.pass}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="review"
                      name="Review required"
                      stroke={CHART_COLORS.review}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted">Submission dates are unavailable for these records.</p>
              )}
            </Card>

            <Card
              title="Risk Score Distribution"
              icon="chart"
              description="Completed claims grouped by screening score"
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={riskDistribution} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(147, 51, 234, 0.2)" />
                  <XAxis dataKey="range" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Claims" fill="#a87ee5" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="two-col mt">
            <Card
              title="Outcomes by Claim Type"
              icon="layers"
              description="Claim counts by outcome; review indicators are not fraud determinations"
            >
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={outcomesByClaimType} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(147, 51, 234, 0.2)" />
                  <XAxis dataKey="name" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="clear" fill={CHART_COLORS.pass} name="No review flags" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="review" fill={CHART_COLORS.review} name="Review required" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="incomplete" fill={CHART_COLORS.incomplete} name="Incomplete" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Photo Evidence Coverage"
              icon="image"
              description={`${claimsWithPhotos} of ${finishedRecords.length} completed claims include photos`}
            >
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-4xl font-bold text-white">{photoCoveragePercent}%</span>
                  <span className="text-sm text-purple-200 text-right">included at least one photo</span>
                </div>
                <div
                  className="h-3 w-full rounded-full bg-purple-950 overflow-hidden"
                  role="progressbar"
                  aria-label="Claims with photo evidence"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={photoCoveragePercent}
                >
                  <div
                    className="h-full bg-purple-400 rounded-full transition-all"
                    style={{ width: `${photoCoveragePercent}%` }}
                  />
                </div>
                <p className="text-sm text-purple-200 leading-relaxed">
                  Photo coverage describes submitted evidence only; it is not a fraud indicator. Image analysis is skipped when no photos are provided.
                </p>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
