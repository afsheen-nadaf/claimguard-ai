import { CLAIM_TYPES } from "../api/config";
import { todayISO } from "./format";

export const MAX_AMOUNT = 100_000_000_000; // ₹10,000 crore sanity ceiling

export const EMPTY_FORM = {
  claimType: "",
  policyNumber: "",
  incidentDate: "",
  amount: "",
  location: "",
  description: "",
};

export const FIELD_ORDER = ["claimType", "policyNumber", "incidentDate", "amount", "location", "description"];

export function validateField(name, form) {
  const value = form[name];
  switch (name) {
    case "claimType":
      if (!value) return "Select a claim type.";
      if (!CLAIM_TYPES.includes(value)) return "Choose one of the listed claim types.";
      return null;
    case "policyNumber": {
      const v = value.trim();
      if (!v) return "Enter the policy number.";
      if (v.length > 80) return "Policy number must be 80 characters or fewer.";
      return null;
    }
    case "incidentDate": {
      if (!value) return "Select the incident date.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid date.";
      const [y, m, d] = value.split("-").map(Number);
      const parsed = new Date(y, m - 1, d);
      if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
        return "Enter a valid date.";
      }
      if (y < 1990) return "Incident date looks too far in the past.";
      if (value > todayISO()) return "Incident date cannot be in the future.";
      return null;
    }
    case "amount": {
      const v = String(value).trim();
      if (!v) return "Enter the claim amount.";
      if (!/^\d+(\.\d{1,2})?$/.test(v)) return "Use a positive number with at most 2 decimal places.";
      const n = Number(v);
      if (n <= 0) return "Claim amount must be greater than zero.";
      if (n > MAX_AMOUNT) return "Claim amount is unrealistically large. Check for typos.";
      return null;
    }
    case "location":
      if (!value.trim()) return "Enter the incident location.";
      return null;
    case "description":
      if (!value.trim()) return "Describe what happened.";
      return null;
    default:
      return null;
  }
}

export function validateClaim(form) {
  const errors = {};
  for (const name of FIELD_ORDER) {
    const message = validateField(name, form);
    if (message) errors[name] = message;
  }
  return errors;
}

// The exact snapshot sent to the screening endpoints.
export function toClaimSnapshot(form) {
  return {
    claimType: form.claimType,
    policyNumber: form.policyNumber.trim(),
    incidentDate: form.incidentDate,
    claimAmountINR: Number(form.amount),
    // Held for reviewer context only; not sent to any screening endpoint.
    location: form.location.trim(),
    description: form.description.trim(),
  };
}

export function newClaimId() {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().split("-")[0].toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `CG-${Date.now()}-${random}`;
}
