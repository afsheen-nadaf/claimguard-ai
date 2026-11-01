import { ENDPOINTS, UPLOAD_RULES } from "./config";
import { ApiError, postJson, putToPresignedUrl } from "./client";

export function resolveContentType(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  return file.type || UPLOAD_RULES.extensionToType[extension] || null;
}

// Step 1: ask the API for a presigned URL. Step 2: PUT the file straight to S3.
// Request payload is identical to the original implementation.
export async function uploadDocument(file, onProgress) {
  const contentType = resolveContentType(file);
  if (!contentType) throw new ApiError("Unsupported file type.", { kind: "parse" });

  const presign = await postJson(ENDPOINTS.presign, {
    filename: file.name,
    contentType,
    fileSize: file.size,
  });
  if (!presign.uploadUrl) {
    throw new ApiError(presign.error || "Could not prepare the upload.", { kind: "parse", body: presign });
  }
  await putToPresignedUrl(presign.uploadUrl, file, contentType, onProgress);
}

// A claim snapshot is { policyNumber, claimType, incidentDate, claimAmountINR }.
export function validatePolicy(claim) {
  return postJson(ENDPOINTS.validate, {
    policyNumber: claim.policyNumber,
    claimType: claim.claimType,
    incidentDate: claim.incidentDate,
    claimAmountINR: claim.claimAmountINR,
  });
}

// NOTE: this call also registers the claim for future duplicate comparisons.
// The same claimId is reused on retry so it stays idempotent.
export function checkDuplicate(claimId, claim) {
  return postJson(ENDPOINTS.duplicate, {
    claimId,
    policyNumber: claim.policyNumber,
    incidentDate: claim.incidentDate,
    claimAmountINR: claim.claimAmountINR,
  });
}

export function checkOutlier(claim) {
  return postJson(ENDPOINTS.outlier, {
    claimType: claim.claimType,
    claimAmountINR: claim.claimAmountINR,
  });
}
