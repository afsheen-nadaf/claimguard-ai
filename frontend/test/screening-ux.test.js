import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECK_ORDER,
  filterHistoryRecords,
  getChecksNeedingAttention,
  interpretForensics,
  summarizeRecord,
  summarize,
} from "../src/lib/screening.js";

function makeChecks(state = "pass") {
  return Object.fromEntries(CHECK_ORDER.map((key) => [
    key,
    { status: "done", result: { state, label: state } },
  ]));
}

function makeRecord(id, { policyNumber, claimType = "Auto", submittedAt, checks = makeChecks() }) {
  return {
    id,
    claim: { policyNumber, claimType },
    submittedAt,
    checks,
  };
}

test("history search matches policy, claim ID, and type without case sensitivity", () => {
  const records = [
    makeRecord("CLM-102", { policyNumber: "POL-AB12", submittedAt: 2 }),
    makeRecord("CLM-103", { policyNumber: "POL-CD34", claimType: "Health", submittedAt: 1 }),
  ];

  assert.deepEqual(
    filterHistoryRecords(records, { query: "pol-ab" }).map((record) => record.id),
    ["CLM-102"],
  );
  assert.deepEqual(
    filterHistoryRecords(records, { query: "clm-103" }).map((record) => record.id),
    ["CLM-103"],
  );
  assert.deepEqual(
    filterHistoryRecords(records, { query: "health" }).map((record) => record.id),
    ["CLM-103"],
  );
});

test("history outcome filters include review, incomplete, and running claims", () => {
  const reviewChecks = makeChecks();
  reviewChecks.policy.result.state = "review";
  const incompleteChecks = makeChecks();
  incompleteChecks.evidence.result.state = "inconclusive";
  const failedChecks = makeChecks();
  for (const check of Object.values(failedChecks)) {
    check.status = "error";
  }
  const runningChecks = makeChecks();
  runningChecks.consistency.status = "running";
  const records = [
    makeRecord("review", { policyNumber: "A", submittedAt: 3, checks: reviewChecks }),
    makeRecord("incomplete", { policyNumber: "B", submittedAt: 4, checks: incompleteChecks }),
    makeRecord("failed", { policyNumber: "D", submittedAt: 3, checks: failedChecks }),
    makeRecord("running", { policyNumber: "C", submittedAt: 1, checks: runningChecks }),
  ];

  assert.deepEqual(filterHistoryRecords(records, { outcome: "review" }).map((record) => record.id), ["review"]);
  assert.deepEqual(filterHistoryRecords(records, { outcome: "incomplete" }).map((record) => record.id), ["incomplete", "failed"]);
  assert.deepEqual(filterHistoryRecords(records, { outcome: "progress" }).map((record) => record.id), ["running"]);
  assert.deepEqual(filterHistoryRecords([makeRecord("clear", { policyNumber: "E", submittedAt: 0 })], { outcome: "clear" }).map((record) => record.id), ["clear"]);
});

test("history records without check details remain unavailable, not clear", () => {
  const record = makeRecord("aws-record", {
    policyNumber: "AWS-1",
    submittedAt: 1,
    checks: {},
  });

  assert.equal(summarize(record.checks).key, "unavailable");
  assert.deepEqual(filterHistoryRecords([record], { outcome: "clear" }), []);
  assert.deepEqual(
    filterHistoryRecords([record], { outcome: "unavailable" }).map((item) => item.id),
    ["aws-record"],
  );
});

test("skipped image forensics is not counted as a pass or incomplete result", () => {
  const checks = makeChecks();
  checks.forensics.result = interpretForensics({
    analysisStatus: "COMPLETED",
    imagesSubmitted: 0,
  });
  const record = makeRecord("no-photos", {
    policyNumber: "NO-PHOTOS",
    submittedAt: 2,
    checks,
  });
  const summary = summarize(checks);

  assert.equal(summary.key, "clear");
  assert.equal(summary.counts.passed, CHECK_ORDER.length - 1);
  assert.equal(summary.counts.skipped, 1);
  assert.equal(summary.counts.incomplete, 0);
  assert.match(summary.text, /skipped checks are not counted as passes/);
  assert.deepEqual(filterHistoryRecords([record], { outcome: "clear" }), []);
  assert.deepEqual(filterHistoryRecords([record], { outcome: "skipped" }), [record]);
  assert.equal(interpretForensics({ skipped: true }).state, "skipped");
});

test("legacy no-photo records with pass-shaped forensics are normalized as skipped", () => {
  const record = makeRecord("legacy-no-photos", {
    policyNumber: "NO-PHOTOS",
    submittedAt: 2,
  });
  record.documents = [];
  record.checks.forensics.result = {
    state: "pass",
    kind: "skipped",
    label: "No image files submitted",
  };

  const summary = summarizeRecord(record);

  assert.equal(summary.counts.passed, CHECK_ORDER.length - 1);
  assert.equal(summary.counts.skipped, 1);
  assert.equal(summary.title, "No flags · 1 skipped");
  assert.deepEqual(filterHistoryRecords([record], { outcome: "skipped" }), [record]);
});

test("history sorting is newest-first by default and does not mutate records", () => {
  const records = [
    makeRecord("older", { policyNumber: "A", submittedAt: 1 }),
    makeRecord("newer", { policyNumber: "B", submittedAt: 3 }),
    makeRecord("middle", { policyNumber: "C", submittedAt: 2 }),
  ];

  assert.deepEqual(filterHistoryRecords(records).map((record) => record.id), ["newer", "middle", "older"]);
  assert.deepEqual(filterHistoryRecords(records, { sortOrder: "oldest" }).map((record) => record.id), ["older", "middle", "newer"]);
  assert.deepEqual(records.map((record) => record.id), ["older", "newer", "middle"]);
});

test("triage orders review flags before failed and inconclusive checks", () => {
  const checks = makeChecks();
  checks.evidence.result.state = "inconclusive";
  checks.duplicate.status = "error";
  checks.consistency.result.state = "review";

  assert.deepEqual(getChecksNeedingAttention(checks), ["consistency", "duplicate", "evidence"]);
});

test("triage excludes passed and still-running checks", () => {
  const checks = makeChecks();
  checks.consistency.status = "running";

  assert.deepEqual(getChecksNeedingAttention(checks), []);
});
