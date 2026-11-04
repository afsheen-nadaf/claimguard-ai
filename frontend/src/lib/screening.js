
// Turns raw API responses into display models and derives the overall summary.
//
// The validate and check-outlier response contracts were not available when this
// was written, so field lookup accepts several likely key names and everything
// unrecognised is surfaced (never guessed). An unrecognised status is treated as
// "inconclusive", never as a pass.

import { humanize, toNumber } from "./format.js";

export const CHECK_ORDER = ["policy", "duplicate", "outlier", "forensics", "relevance"];

// ---------- helpers ----------

export function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }

  return undefined;
}

function normalizeStatus(value) {
  if (value === undefined || value === null) return null;

  return String(value).trim().toUpperCase().replace(/[\s-]+/g, "_");
}

// Merge one level of commonly-used nesting so metrics are found either way.
function flatten(response) {
  const nested = [
    "statistics",
    "stats",
    "metrics",
    "details",
    "result",
    "baseline",
  ];

  let merged = { ...response };

  for (const key of nested) {
    const inner = response?.[key];

    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      merged = { ...inner, ...merged };
    }
  }

  return merged;
}

export function normalizeFlags(raw) {
  if (raw === undefined || raw === null) return [];

  const list = Array.isArray(raw) ? raw : [raw];

  return list
    .map((item) => {
      if (item === null || item === undefined || item === "") return null;

      if (typeof item === "string") {
        return { text: item };
      }

      if (typeof item === "object") {
        const text = pick(item, [
          "message",
          "reason",
          "description",
          "detail",
          "text",
          "flag",
          "code",
        ]);

        const code = pick(item, ["code", "flag", "type"]);
        const severity = pick(item, ["severity", "level"]);

        if (text === undefined && code === undefined) {
          return { text: JSON.stringify(item) };
        }

        return {
          text: String(text ?? code),
          code:
            code !== undefined && String(code) !== String(text)
              ? String(code)
              : undefined,
          severity: severity !== undefined ? String(severity) : undefined,
        };
      }

      return { text: String(item) };
    })
    .filter(Boolean);
}

function extraFields(response, knownKeys) {
  const known = new Set(knownKeys);

  return Object.entries(response || {})
    .filter(
      ([key, value]) =>
        !known.has(key) &&
        ["string", "number", "boolean"].includes(typeof value)
    )
    .map(([key, value]) => ({
      label: humanize(key),
      value: String(value),
    }));
}

// ---------- policy validation ----------

const POLICY_STATUS_KEYS = [
  "validationStatus",
  "policyStatus",
  "status",
  "result",
];

const POLICY_FLAG_KEYS = [
  "flags",
  "reasons",
  "reasonCodes",
  "issues",
  "violations",
  "failures",
  "warnings",
];

const MESSAGE_KEYS = ["message", "explanation", "reason", "summary"];

const POLICY_PASS = new Set([
  "PASS",
  "PASSED",
  "VALID",
  "VALIDATED",
  "OK",
  "APPROVED",
  "CLEAR",
  "SUCCESS",
  "NO_FLAGS",
  "NO_ISSUES",
]);

const POLICY_REVIEW = new Set([
  "REVIEW",
  "REVIEW_REQUIRED",
  "FLAGGED",
  "INVALID",
  "FAIL",
  "FAILED",
  "REJECTED",
  "FAILED_VALIDATION",
  "MISMATCH",
  "WARNING",
  "SUSPICIOUS",
  "NEEDS_REVIEW",
]);

export function interpretPolicy(response) {
  const rawStatus = pick(response, POLICY_STATUS_KEYS);
  const status = normalizeStatus(rawStatus);
  const flags = normalizeFlags(pick(response, POLICY_FLAG_KEYS));
  const message = pick(response, MESSAGE_KEYS);

  let state = "inconclusive";
  let label =
    rawStatus !== undefined
      ? `Unrecognised status: ${rawStatus}`
      : "No status returned";

  if (status && POLICY_PASS.has(status)) {
    state = "pass";
    label = "Policy checks passed";
  } else if (status && POLICY_REVIEW.has(status)) {
    state = "review";
    label = "Review required";
  } else if (status === null) {
    const bool = pick(response, ["valid", "isValid", "passed"]);

    if (bool === true) {
      state = "pass";
      label = "Policy checks passed";
    } else if (bool === false) {
      state = "review";
      label = "Review required";
    }
  }

  // Conservative: a "pass" that still returns flags is surfaced for review.
  if (state === "pass" && flags.length > 0) {
    state = "review";
    label = "Passed with flags: review required";
  }

  const known = [
    ...POLICY_STATUS_KEYS,
    ...POLICY_FLAG_KEYS,
    ...MESSAGE_KEYS,
    "valid",
    "isValid",
    "passed",
  ];

  return {
    state,
    label,
    rawStatus: rawStatus !== undefined ? String(rawStatus) : null,
    message: message !== undefined ? String(message) : null,
    flags,
    details: extraFields(response, known),
  };
}

// ---------- duplicate detection ----------

function normalizeMatch(match) {
  if (!match || typeof match !== "object") return null;

  return {
    claimId: pick(match, ["claimId", "matchedClaimId"]),
    policyNumber: pick(match, ["policyNumber"]),
    incidentDate: pick(match, ["incidentDate"]),
    claimAmountINR: toNumber(pick(match, ["claimAmountINR"])),
    source: pick(match, ["source"]),
    matchType: pick(match, ["matchType"]),
  };
}

// Normalize image matches returned by the image-hashing backend.
function normalizeImageMatch(match) {
  if (!match || typeof match !== "object") return null;

  return {
    claimId: pick(match, ["claimId", "matchedClaimId"]),
    matchedImageId: pick(match, ["matchedImageId"]),
    uploadedImageKey: pick(match, ["uploadedImageKey"]),
    hammingDistance: toNumber(pick(match, ["hammingDistance"])),
    similarityPercent: toNumber(pick(match, ["similarityPercent"])),
    source: pick(match, ["source"]) || "IMAGE_HASH",
  };
}

export function interpretDuplicate(response) {
  const rawStatus = response?.duplicateStatus;
  const status = normalizeStatus(rawStatus);

  const matches = (
    Array.isArray(response?.matches) ? response.matches : []
  )
    .map(normalizeMatch)
    .filter(Boolean);

  const imageMatches = (
    Array.isArray(response?.imageMatches) ? response.imageMatches : []
  )
    .map(normalizeImageMatch)
    .filter(Boolean);

  const matchedClaimId = response?.matchedClaimId ?? null;
  const message = response?.message ?? null;
  const matchType = response?.matchType ?? null;

  let state = "inconclusive";
  let label = rawStatus
    ? `Unrecognised status: ${rawStatus}`
    : "No status returned";

  let kind = "unknown";

  if (status === "NO_MATCH") {
    state = "pass";
    kind = "no_match";
    label = "No configured duplicate match found";
  } else if (status === "REVIEW") {
    state = "review";
    kind = "review";
    label = "Potential duplicate: review required";
  } else if (status === "ALREADY_REGISTERED") {
    kind = "already_registered";

    if (
      matches.length > 0 ||
      imageMatches.length > 0 ||
      matchedClaimId
    ) {
      state = "review";
      label = "Already registered, with a matching claim on record";
    } else {
      state = "inconclusive";
      label = "Submission already registered";
    }
  }

  // Image matches are an independent reason for analyst review.
  if (imageMatches.length > 0) {
    state = "review";
    kind = "review";
    label = "Potential image duplicate: review required";
  }

  return {
    state,
    kind,
    label,
    rawStatus: rawStatus ?? null,
    message: message !== null ? String(message) : null,
    matchType: matchType !== null ? String(matchType) : null,
    matchedClaimId:
      matchedClaimId !== null ? String(matchedClaimId) : null,
    matches,
    imageMatches,
    imageMatchStatus: response?.imageMatchStatus ?? null,
  };
}

// ---------- amount outlier ----------

const OUTLIER_STATUS_KEYS = [
  "outlierStatus",
  "screeningStatus",
  "status",
];

const OUTLIER_PASS = new Set([
  "NORMAL",
  "WITHIN_RANGE",
  "WITHIN_EXPECTED_RANGE",
  "NO_OUTLIER",
  "NOT_OUTLIER",
  "NOT_AN_OUTLIER",
  "PASS",
  "PASSED",
  "OK",
  "CLEAR",
]);

const OUTLIER_REVIEW = new Set([
  "OUTLIER",
  "REVIEW",
  "REVIEW_REQUIRED",
  "ANOMALY",
  "FLAGGED",
  "POTENTIAL_OUTLIER",
  "HIGH_OUTLIER",
  "LOW_OUTLIER",
  "ABOVE_RANGE",
  "BELOW_RANGE",
  "SUSPICIOUS",
  "NEEDS_REVIEW",
]);

const OUTLIER_INCONCLUSIVE = new Set([
  "INSUFFICIENT_DATA",
  "INSUFFICIENT_SAMPLE",
  "NOT_ENOUGH_DATA",
  "NO_BASELINE",
  "NO_REFERENCE_DATA",
  "UNKNOWN",
  "SKIPPED",
  "NOT_EVALUATED",
]);

const METRIC_KEYS = {
  sampleSize: [
    "sampleSize",
    "historicalSampleSize",
    "sample_size",
    "n",
    "count",
    "historicalCount",
  ],
  method: [
    "method",
    "statisticalMethod",
    "statistical_method",
    "algorithm",
  ],
  median: [
    "median",
    "medianAmount",
    "medianINR",
    "medianClaimAmountINR",
    "historicalMedian",
  ],
  mad: [
    "mad",
    "medianAbsoluteDeviation",
    "madINR",
    "medianAbsoluteDeviationINR",
  ],
  lowerBound: [
    "lowerBound",
    "lowerBoundINR",
    "lower",
    "lowerLimit",
    "lower_bound",
  ],
  upperBound: [
    "upperBound",
    "upperBoundINR",
    "upper",
    "upperLimit",
    "upper_bound",
  ],
  robustZ: [
    "robustZScore",
    "robustZ",
    "robust_z_score",
    "zScore",
    "modifiedZScore",
  ],
  submittedAmount: [
    "claimAmountINR",
    "submittedAmount",
    "amount",
  ],
};

export function interpretOutlier(response) {
  const flat = flatten(response || {});
  const rawStatus = pick(flat, OUTLIER_STATUS_KEYS);
  const status = normalizeStatus(rawStatus);
  const message = pick(flat, MESSAGE_KEYS);

  let state = "inconclusive";
  let label =
    rawStatus !== undefined
      ? `Unrecognised status: ${rawStatus}`
      : "No status returned";

  if (status && OUTLIER_PASS.has(status)) {
    state = "pass";
    label = "Within the historical range";
  } else if (status && OUTLIER_REVIEW.has(status)) {
    state = "review";
    label = "Amount outlier: review required";
  } else if (status && OUTLIER_INCONCLUSIVE.has(status)) {
    state = "inconclusive";
    label = "Not enough reference data to assess";
  }

  const metrics = {
    sampleSize: toNumber(pick(flat, METRIC_KEYS.sampleSize)),
    method:
      pick(flat, METRIC_KEYS.method) !== undefined
        ? String(pick(flat, METRIC_KEYS.method))
        : null,
    median: toNumber(pick(flat, METRIC_KEYS.median)),
    mad: toNumber(pick(flat, METRIC_KEYS.mad)),
    lowerBound: toNumber(pick(flat, METRIC_KEYS.lowerBound)),
    upperBound: toNumber(pick(flat, METRIC_KEYS.upperBound)),
    robustZ: toNumber(pick(flat, METRIC_KEYS.robustZ)),
    submittedAmount: toNumber(pick(flat, METRIC_KEYS.submittedAmount)),
  };

  const known = [
    ...OUTLIER_STATUS_KEYS,
    ...MESSAGE_KEYS,
    ...Object.values(METRIC_KEYS).flat(),
    "claimType",
    "statistics",
    "stats",
    "metrics",
    "details",
    "result",
    "baseline",
  ];

  return {
    state,
    label,
    rawStatus: rawStatus !== undefined ? String(rawStatus) : null,
    message: message !== undefined ? String(message) : null,
    metrics,
    details: extraFields(flat, known),
  };
}

// ---------- image forensics ----------

export function interpretForensics(response) {
  if (!response) {
    return {
      state: "inconclusive",
      kind: "unknown",
      label: "No forensics response returned",
      rawStatus: null,
      images: [],
      imagesSubmitted: 0,
      analysesCompleted: 0,
      analysesWithErrors: 0,
      disclaimer: null,
    };
  }

  if (response.skipped) {
    return {
      state: "pass",
      kind: "skipped",
      label: response.message || "No image files submitted for forensics",
      rawStatus: "SKIPPED",
      images: [],
      imagesSubmitted: 0,
      analysesCompleted: 0,
      analysesWithErrors: 0,
      disclaimer: null,
      skipped: true,
    };
  }

  const rawStatus = response.analysisStatus || "UNKNOWN";
  const images = Array.isArray(response.images) ? response.images : [];
  const imagesSubmitted = response.imagesSubmitted ?? images.length;
  const analysesCompleted = response.analysesCompleted ?? 0;
  const analysesWithErrors = response.analysesWithErrors ?? 0;
  const disclaimer = response.disclaimer ?? null;

  const flaggedImages = images.filter((img) => img.review?.required === true);
  const hasReviewRequired = flaggedImages.length > 0;

  let state;
  let label;
  let kind;

  if (rawStatus === "COMPLETED") {
    if (hasReviewRequired) {
      state = "review";
      kind = "review";
      label = `Human review recommended (${flaggedImages.length} image${flaggedImages.length === 1 ? "" : "s"} flagged)`;
    } else {
      state = "pass";
      kind = "completed";
      label = `Analyzed ${imagesSubmitted} image${imagesSubmitted === 1 ? "" : "s"} (${analysesCompleted} check${analysesCompleted === 1 ? "" : "s"} completed, no review flags)`;
    }
  } else if (rawStatus === "PARTIAL") {
    if (hasReviewRequired) {
      state = "review";
      kind = "review";
      label = `Partially completed with review recommended (${flaggedImages.length} image${flaggedImages.length === 1 ? "" : "s"} flagged, ${analysesWithErrors} check error${analysesWithErrors === 1 ? "" : "s"})`;
    } else {
      state = "inconclusive";
      kind = "partial";
      label = `Partially completed (${analysesCompleted} completed, ${analysesWithErrors} error${analysesWithErrors === 1 ? "" : "s"})`;
    }
  } else if (rawStatus === "FAILED") {
    state = "inconclusive";
    kind = "failed";
    label = `Analysis failed (${analysesWithErrors} error${analysesWithErrors === 1 ? "" : "s"})`;
  } else {
    state = "inconclusive";
    kind = "unknown";
    label = `Status: ${rawStatus}`;
  }

  return {
    state,
    kind,
    label,
    rawStatus,
    imagesSubmitted,
    analysesCompleted,
    analysesWithErrors,
    images,
    disclaimer,
    hasReviewRequired,
    flaggedCount: flaggedImages.length,
  };
}

export function interpretRelevance(response) {
  if (!response || typeof response !== "object") {
    return {
      state: "inconclusive",
      kind: "unavailable",
      label: "Evidence relevance unavailable",
      overallVerdict: "UNCERTAIN",
      overallStatus: "UNAVAILABLE",
      requiresReview: true,
      evidenceResults: [],
      disclaimer: null,
    };
  }

  if (response.skipped) {
    return {
      state: "pass",
      kind: "skipped",
      label: response.message || "No evidence files submitted",
      overallVerdict: "UNCERTAIN",
      overallStatus: "SKIPPED",
      requiresReview: false,
      evidenceResults: [],
      disclaimer: null,
      skipped: true,
    };
  }

  const overallStatus = response.overallStatus || "COMPLETED";
  const overallVerdict = response.overallVerdict || "UNCERTAIN";
  const requiresReview = Boolean(response.requiresReview);
  const evidenceResults = Array.isArray(response.evidenceResults)
    ? response.evidenceResults
    : [];
  const disclaimer = response.disclaimer || null;

  let state;
  let label;
  let kind;

  if (overallVerdict === "RELEVANT" && !requiresReview && overallStatus === "COMPLETED") {
    state = "pass";
    kind = "completed";
    label = `Evidence supports claim narrative (${evidenceResults.length} item${
      evidenceResults.length === 1 ? "" : "s"
    } relevant)`;
  } else if (overallVerdict === "POTENTIAL_MISMATCH") {
    state = "review";
    kind = "review";
    label = "Potential mismatch detected between evidence and claim narrative";
  } else if (overallVerdict === "UNCERTAIN") {
    state = "review";
    kind = "review";
    label = "Evidence relevance is uncertain or unreadable (analyst review needed)";
  } else if (overallStatus === "PARTIAL") {
    state = "review";
    kind = "partial";
    label = "Evidence partially validated (some items encountered errors)";
  } else if (overallStatus === "FAILED") {
    state = "inconclusive";
    kind = "failed";
    label = "Evidence relevance validation failed";
  } else {
    state = "inconclusive";
    kind = "unknown";
    label = `Relevance status: ${overallStatus}`;
  }

  return {
    state,
    kind,
    label,
    overallStatus,
    overallVerdict,
    requiresReview,
    evidenceResults,
    disclaimer,
  };
}

// ---------- overall summary ----------

export const SUMMARY_COPY = {
  progress: {
    tone: "info",
    title: "Screening in progress",
    text: "Checks are still running. Results will appear below as each one finishes.",
    next: "Wait for all checks to finish before drawing any conclusion.",
  },

  clear: {
    tone: "success",
    title: "No configured indicators found",
    text: "None of the configured checks raised an indicator for this claim.",
    next: "Continue standard claims handling. These checks only cover policy rules, duplicate matching and claim-amount range. They do not confirm the claim is genuine.",
  },

  review: {
    tone: "warning",
    title: "Review required",
    text: "At least one check raised an indicator that a person should look at.",
    next: "Assign this claim to an analyst. Compare the flagged checks with the supporting documents before any decision is made.",
  },

  partial: {
    tone: "warning",
    title: "Partially screened",
    text: "Some checks could not be completed or interpreted, so this claim has not been fully screened.",
    next: "Retry the incomplete checks, or review the claim manually. Do not treat it as cleared.",
  },

  failed: {
    tone: "danger",
    title: "Screening failed",
    text: "No check completed successfully.",
    next: "Retry the checks. If failures persist, confirm the API is reachable. This claim has not been screened.",
  },
};

export function summarize(checks) {
  const entries = CHECK_ORDER.map((key) => checks[key]).filter(Boolean);

  const total = entries.length;

  const pending = entries.filter(
    (c) => c.status === "idle" || c.status === "running"
  ).length;

  const passed = entries.filter(
    (c) => c.status === "done" && c.result?.state === "pass"
  ).length;

  const review = entries.filter(
    (c) => c.status === "done" && c.result?.state === "review"
  ).length;

  const errored = entries.filter(
    (c) => c.status === "error"
  ).length;

  const inconclusive = entries.filter(
    (c) => c.status === "done" && c.result?.state === "inconclusive"
  ).length;

  const incomplete = errored + inconclusive;

  let key;

  if (pending > 0) {
    key = "progress";
  } else if (errored === total) {
    key = "failed";
  } else if (review > 0) {
    key = "review";
  } else if (incomplete > 0) {
    key = "partial";
  } else {
    key = "clear";
  }

  return {
    key,
    ...SUMMARY_COPY[key],
    counts: {
      total,
      passed,
      review,
      incomplete,
      errored,
      inconclusive,
      pending,
    },
  };
}
