import { checkDuplicate, checkOutlier, validatePolicy } from "../api/claims";
import { interpretDuplicate, interpretOutlier, interpretPolicy } from "./screening";

// One place that wires each screening check to its endpoint and interpreter.
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
    run: (claimId, claim) => checkDuplicate(claimId, claim),
    interpret: interpretDuplicate,
  },
  outlier: {
    key: "outlier",
    title: "Claim-amount outlier detection",
    icon: "sliders",
    run: (_claimId, claim) => checkOutlier(claim),
    interpret: interpretOutlier,
  },
};
