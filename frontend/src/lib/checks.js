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

export const CHECKS = {
  policy: {
    key: "policy",
    title: "Policy Validation",
    description: "Validates policy details against deterministic rules and requirements.",
    icon: "clipboard",
    run: (_claimId, claim) => validatePolicy(claim),
    interpret: interpretPolicy,
  },

  duplicate: {
    key: "duplicate",
    title: "Duplicate-Claim Detection",
    description: "Compares claim details and images with earlier submissions to detect duplicates.",
    icon: "copy",
    run: (claimId, claim, documents) => checkDuplicate(claimId, claim, documents),
    interpret: interpretDuplicate,
  },

  outlier: {
    key: "outlier",
    title: "Claim-Amount Outlier Detection",
    description: "Statistical analysis to identify unusually high or low claim amounts.",
    icon: "sliders",
    run: (_claimId, claim) => checkOutlier(claim),
    interpret: interpretOutlier,
  },

  forensics: {
    key: "forensics",
    title: "Image Forensics Analysis",
    description: "Deep analysis of image metadata, compression, and AI-generation signals.",
    icon: "image",
    run: (claimId, _claim, documents) => analyzeClaimImages(claimId, documents),
    interpret: interpretForensics,
  },

  evidence: {
    key: "evidence",
    title: "Evidence Relevance Validation",
    description: "Verifies that uploaded documents and photos match the reported incident.",
    icon: "search",
    run: (claimId, claim, documents) => validateEvidence(claimId, claim, documents),
    interpret: interpretEvidence,
  },

  consistency: {
    key: "consistency",
    title: "Cross-Document Consistency",
    description: "Compares details extracted from documents and cross-checks multiple photos for visual consistency.",
    icon: "layers",
    run: (claimId, claim, documents) =>
      runConsistencyCheck(documents, claimId, claim),
    interpret: interpretConsistency,
  },
};