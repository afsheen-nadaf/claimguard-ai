import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalyticsData } from "../src/lib/analytics.js";
import { CHECK_ORDER } from "../src/lib/screening.js";

function makeRecord(id, { claimType, submittedAt, state = "pass", documents = [] }) {
  const checks = Object.fromEntries(
    CHECK_ORDER.map((key) => [
      key,
      {
        status: "done",
        result: { state: key === "policy" ? state : "pass" },
      },
    ])
  );

  return {
    id,
    submittedAt,
    claim: { claimType },
    documents,
    checks,
  };
}

test("analytics excludes claim-history rows without screening details", () => {
  const records = [
    makeRecord("clear", {
      claimType: "Auto",
      submittedAt: Date.UTC(2026, 0, 1),
      documents: [{ name: "damage.jpg", type: "image/jpeg" }],
    }),
    makeRecord("review", {
      claimType: "Property",
      submittedAt: Date.UTC(2026, 0, 2),
      state: "review",
    }),
    {
      id: "history-only",
      claim: { claimType: "Health" },
      checks: {},
    },
  ];

  const analytics = buildAnalyticsData(records);

  assert.equal(analytics.completeRecordCount, 2);
  assert.equal(analytics.excludedRecordCount, 1);
  assert.equal(analytics.finishedRecords.length, 2);
  assert.equal(analytics.byOutcome.clear, 1);
  assert.equal(analytics.byOutcome.review, 1);
  assert.equal(analytics.avgRiskScore, 20);
  assert.deepEqual(
    analytics.riskDistribution.filter((bucket) => bucket.count > 0),
    [
      { range: "0-20", count: 1 },
      { range: "21-40", count: 1 },
    ]
  );
  assert.deepEqual(
    analytics.screeningsOverTime.map(({ date, screened, review }) => ({
      date,
      screened,
      review,
    })),
    [
      { date: "2026-01-01", screened: 1, review: 0 },
      { date: "2026-01-02", screened: 1, review: 1 },
    ]
  );
  assert.equal(analytics.claimsWithPhotos, 1);
  assert.equal(analytics.photoCoveragePercent, 50);
});

test("analytics returns empty chart datasets when there are no complete records", () => {
  const analytics = buildAnalyticsData([{ id: "history-only", checks: {} }]);

  assert.equal(analytics.finishedRecords.length, 0);
  assert.equal(analytics.excludedRecordCount, 1);
  assert.deepEqual(analytics.screeningsOverTime, []);
  assert.equal(analytics.photoCoveragePercent, 0);
});

test("analytics separates skipped checks from passed and incomplete checks", () => {
  const record = makeRecord("no-photos", {
    claimType: "Auto",
    submittedAt: Date.UTC(2026, 0, 3),
  });
  record.checks.forensics.result = { state: "skipped" };

  const analytics = buildAnalyticsData([record]);
  const forensics = analytics.perCheck.find((check) => check.key === "forensics");

  assert.equal(forensics.pass, 0);
  assert.equal(forensics.skipped, 1);
  assert.equal(forensics.incomplete, 0);
});
