const env = import.meta.env || globalThis.process?.env || {};

export const REGION = env.VITE_AWS_REGION || "";
export const API_BASE = (env.VITE_API_BASE || "").replace(/\/+$/, "");
export const ANALYZE_IMAGE_URL = env.VITE_ANALYZE_URL || "";

export const ENDPOINTS = {
  presign: `${API_BASE}/uploads/presign`,
  validate: `${API_BASE}/claims/validate`,
  duplicate: `${API_BASE}/claims/check-duplicate`,
  outlier: `${API_BASE}/claims/check-outlier`,
  analyzeImage: ANALYZE_IMAGE_URL,
  extractDocument: `${API_BASE}/claims/extract-document`,
  validateEvidence: `${API_BASE}/claims/validate-evidence`,
  fetchHistory: `${API_BASE}/claims/history`,
  saveResults: `${API_BASE}/claims/screening-results`,
  submit: `${API_BASE}/claims/submit`,
  status: `${API_BASE}/claims/status`,
};

export const UPLOAD_RULES = {
  maxBytes: 10 * 1024 * 1024,
  maxImages: 2,
  allowedTypes: ["application/pdf", "image/jpeg", "image/png"],
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
  extensionToType: {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  },
};

export const CLAIM_TYPES = ["Auto", "Property", "Health", "Travel"];
