
import { ENDPOINTS, UPLOAD_RULES } from "./config";
import { ApiError, postJson, putToPresignedUrl } from "./client";

export function resolveContentType(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();

  return file.type || UPLOAD_RULES.extensionToType[extension] || null;
}

// Request a presigned URL, upload directly to S3,
// and return the S3 object key.
export async function uploadDocument(file, onProgress) {
  const contentType = resolveContentType(file);

  if (!contentType) {
    throw new ApiError("Unsupported file type.", {
      kind: "parse",
    });
  }

  const presign = await postJson(ENDPOINTS.presign, {
    filename: file.name,
    contentType,
    fileSize: file.size,
  });

  if (!presign.uploadUrl || !presign.key) {
    throw new ApiError(
      presign.error || "Could not prepare the upload.",
      {
        kind: "parse",
        body: presign,
      }
    );
  }

  await putToPresignedUrl(
    presign.uploadUrl,
    file,
    contentType,
    onProgress
  );

  return {
    key: presign.key,
    filename: file.name,
    contentType,
    fileSize: file.size,
  };
}

export function validatePolicy(claim) {
  return postJson(ENDPOINTS.validate, {
    policyNumber: claim.policyNumber,
    claimType: claim.claimType,
    incidentDate: claim.incidentDate,
    claimAmountINR: claim.claimAmountINR,
  });
}

// Pass uploaded image S3 keys to the duplicate-check Lambda.
export function checkDuplicate(claimId, claim, documents = []) {
  const imageKeys = documents
    .filter((document) =>
      ["image/jpeg", "image/png"].includes(document.type)
    )
    .map((document) => document.s3Key)
    .filter(Boolean);

  return postJson(ENDPOINTS.duplicate, {
    claimId,
    policyNumber: claim.policyNumber,
    incidentDate: claim.incidentDate,
    claimAmountINR: claim.claimAmountINR,
    imageKeys,
  });
}

export function checkOutlier(claim) {
  return postJson(ENDPOINTS.outlier, {
    claimType: claim.claimType,
    claimAmountINR: claim.claimAmountINR,
  });
}
