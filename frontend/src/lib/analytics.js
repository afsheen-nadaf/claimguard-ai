import {
  CHECK_ORDER,
  calculateRiskScore,
  normalizeSkippedForensics,
  summarize,
} from "./screening.js";

const RISK_BUCKETS = [
  { range: "0-20", min: 0, max: 20 },
  { range: "21-40", min: 21, max: 40 },
  { range: "41-60", min: 41, max: 60 },
  { range: "61-80", min: 61, max: 80 },
  { range: "81-100", min: 81, max: 100 },
];

function hasImageEvidence(record) {
  return (record.documents || []).some((document) =>
    ["image/jpeg", "image/png"].includes(document.type) ||
    /\.(jpe?g|png)$/i.test(document.name || "")
  );
}

function groupByDay(entries) {
  const days = new Map();

  for (const { record, summary } of entries) {
    const date = new Date(record.submittedAt);
    if (Number.isNaN(date.getTime())) continue;

    const dateKey = date.toISOString().slice(0, 10);
    const bucket = days.get(dateKey) || {
      date: dateKey,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      screened: 0,
      review: 0,
    };

    bucket.screened += 1;
    if (summary.key === "review") bucket.review += 1;
    days.set(dateKey, bucket);
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildAnalyticsData(records) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const normalizedRecords = sourceRecords.map((record) => ({
    ...record,
    checks: normalizeSkippedForensics(record),
  }));
  const completeRecords = normalizedRecords.filter((record) =>
    CHECK_ORDER.every((key) => record.checks?.[key])
  );
  const finishedRecords = completeRecords
    .map((record) => ({ record, summary: summarize(record.checks) }))
    .filter(({ summary }) => summary.key !== "progress");

  const byOutcome = {
    clear: 0,
    review: 0,
    partial: 0,
    failed: 0,
  };
  const outcomesByClaimType = new Map();

  for (const { record, summary } of finishedRecords) {
    byOutcome[summary.key] += 1;

    const name = record.claim?.claimType || "Unknown";
    const outcome = summary.key === "clear"
      ? "clear"
      : summary.key === "review"
        ? "review"
        : "incomplete";
    const counts = outcomesByClaimType.get(name) || {
      name,
      clear: 0,
      review: 0,
      incomplete: 0,
    };
    counts[outcome] += 1;
    outcomesByClaimType.set(name, counts);
  }

  const perCheck = CHECK_ORDER.map((key) => {
    const rows = completeRecords
      .map((record) => record.checks[key])
      .filter((check) => check.status === "done" || check.status === "error");
    return {
      key,
      pass: rows.filter((check) => check.status === "done" && check.result?.state === "pass").length,
      review: rows.filter((check) => check.status === "done" && check.result?.state === "review").length,
      skipped: rows.filter((check) => check.status === "done" && check.result?.state === "skipped").length,
      incomplete: rows.filter((check) => check.status === "error" || check.result?.state === "inconclusive").length,
    };
  });

  const riskScores = finishedRecords.map(({ record }) => calculateRiskScore(record.checks));
  const riskDistribution = RISK_BUCKETS.map(({ range, min, max }) => ({
    range,
    count: riskScores.filter((score) => score >= min && score <= max).length,
  }));
  const claimsWithPhotos = finishedRecords.filter(({ record }) => hasImageEvidence(record)).length;

  return {
    completeRecordCount: completeRecords.length,
    excludedRecordCount: sourceRecords.length - completeRecords.length,
    finishedRecords,
    byOutcome,
    perCheck,
    avgRiskScore: riskScores.length
      ? Math.round(riskScores.reduce((total, score) => total + score, 0) / riskScores.length)
      : 0,
    riskDistribution,
    screeningsOverTime: groupByDay(finishedRecords),
    outcomesByClaimType: [...outcomesByClaimType.values()].sort((a, b) => a.name.localeCompare(b.name)),
    claimsWithPhotos,
    photoCoveragePercent: finishedRecords.length
      ? Math.round((claimsWithPhotos / finishedRecords.length) * 100)
      : 0,
  };
}
