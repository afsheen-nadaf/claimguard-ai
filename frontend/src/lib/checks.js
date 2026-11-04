
import {
  analyzeClaimImages,
  checkDuplicate,
  checkOutlier,
  validateEvidenceRelevance,
  validatePolicy,
} from "../api/claims";

import {
  interpretDuplicate,
  interpretForensics,
  interpretOutlier,
  interpretPolicy,
  interpretRelevance,
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

  relevance: {
    key: "relevance",
    title: "Evidence relevance validation",
    icon: "file",

    run: (claimId, claim, documents) =>
      validateEvidenceRelevance(claimId, claim, documents),

    interpret: interpretRelevance,
  },
};
