
import {
  analyzeClaimImages,
  checkDuplicate,
  checkOutlier,
  validateEvidence,
  validatePolicy,
} from "../api/claims";

import { runConsistencyCheck } from "./consistency";
import {
  interpretConsistency,
  interpretDuplicate,
  interpretEvidence,
  interpretForensics,
  interpretOutlier,
  interpretPolicy,
} from "./screening.js";

// One place that wires each screening check
// to its endpoint and result interpreter.
export const CHECKS = {
  policy: {
    key: "policy",
    title: "Policy validation",
    icon: "clipboard",

    run: (_claimId, claim) => validatePolicy(claim),

    interpret: interpretPolicy,
  },

  duplicate: {
    key: "duplicate",
    title: "Duplicate-claim detection",
    icon: "copy",

    run: (claimId, claim, documents) =>
      checkDuplicate(claimId, claim, documents),

    interpret: interpretDuplicate,
  },

  outlier: {
    key: "outlier",
    title: "Claim-amount outlier detection",
    icon: "sliders",

    run: (_claimId, claim) => checkOutlier(claim),

    interpret: interpretOutlier,
  },

  forensics: {
    key: "forensics",
    title: "Image forensics analysis",
    icon: "image",

    run: (claimId, _claim, documents) =>
      analyzeClaimImages(claimId, documents),

    interpret: interpretForensics,
  },

  evidence: {
    key: "evidence",
    title: "Evidence relevance validation",
    icon: "search",

    run: (claimId, claim, documents) =>
      validateEvidence(claimId, claim, documents),

    interpret: interpretEvidence,
  },

  consistency: {
    key: "consistency",
    title: "Cross-document consistency",
    icon: "layers",

    // Pure frontend check — no backend endpoint. Compares extractedData
    // across uploaded documents to detect field mismatches.
    run: (_claimId, _claim, documents) =>
      Promise.resolve(runConsistencyCheck(documents)),

    interpret: interpretConsistency,
  },
};
