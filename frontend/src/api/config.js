// Central API configuration. Endpoint URLs are unchanged from the original app.
// Override the base with VITE_API_BASE in a .env file if you redeploy the stack.

export const REGION = "ap-southeast-2";

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://7cd0wz7wh0.execute-api.ap-southeast-2.amazonaws.com/Prod";

export const ENDPOINTS = {
  presign: `${API_BASE}/uploads/presign`,
  validate: `${API_BASE}/claims/validate`,
  duplicate: `${API_BASE}/claims/check-duplicate`,
  outlier: `${API_BASE}/claims/check-outlier`,
};

export const UPLOAD_RULES = {
  maxBytes: 10 * 1024 * 1024,
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
