import test from "node:test";
import assert from "node:assert/strict";
import { CHECK_ORDER, filterHistoryRecords, getChecksNeedingAttention } from "../src/lib/screening.js";

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
