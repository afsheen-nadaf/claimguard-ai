
import { ENDPOINTS, UPLOAD_RULES } from "./config.js";
import { ApiError, postJson, putToPresignedUrl } from "./client.js";

export function resolveContentType(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();

  return file.type || UPLOAD_RULES.extensionToType[extension] || null;
}

// Request a presigned URL, upload directly to S3,
// and return the S3 object key.
export async function uploadDocument(file, onProgress, claimId) {
  const contentType = resolveContentType(file);

  if (!contentType) {
    throw new ApiError("Unsupported file type.", {
      kind: "parse",
    });
  }

  const payload = {
    filename: file.name,
    contentType,
    fileSize: file.size,
  };

  if (claimId) {
    payload.claimId = claimId;
  }

  const presign = await postJson(ENDPOINTS.presign, payload);

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

// Analyze uploaded claim images using the AWS Lambda image-forensics service.
// Extracts S3 keys, filters out PDFs, bounds to maximum 3 images, and avoids calling
// the endpoint if no images are present.
export function analyzeClaimImages(claimId, documents = []) {
  const imageKeys = documents
    .filter((document) => {
      const ext = (document.name?.split(".").pop() || "").toLowerCase();
      const type = document.type || "";
      return (
        ["image/jpeg", "image/png"].includes(type) ||
        ["jpg", "jpeg", "png"].includes(ext)
      );
    })
    .map((document) => document.s3Key)
    .filter(Boolean);

  if (imageKeys.length === 0) {
    return Promise.resolve({
      skipped: true,
      reason: "NO_IMAGES",
      claimId,
      analysisStatus: "SKIPPED",
      imagesSubmitted: 0,
      analysesCompleted: 0,
      analysesWithErrors: 0,
      images: [],
      message: "No JPG, JPEG or PNG images were uploaded for this claim.",
    });
  }

  const boundedKeys = imageKeys.slice(0, 3);

  return postJson(ENDPOINTS.analyzeImage, {
    claimId,
    imageKeys: boundedKeys,
  });
}

// Validate evidence relevance using Amazon Bedrock Converse API.
// Accepts both image and PDF document evidence, bounded to maximum 3 items.
export function validateEvidenceRelevance(claimId, claim = {}, documents = []) {
  const evidenceItems = documents
    .filter((doc) => {
      const ext = (doc.name?.split(".").pop() || "").toLowerCase();
      const type = doc.type || "";
      return (
        ["image/jpeg", "image/png", "application/pdf"].includes(type) ||
        ["jpg", "jpeg", "png", "pdf"].includes(ext)
      );
    })
    .map((doc) => {
      const ext = (doc.name?.split(".").pop() || "").toLowerCase();
      let contentType = doc.type;
      if (!contentType) {
        if (["jpg", "jpeg"].includes(ext)) contentType = "image/jpeg";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "pdf") contentType = "application/pdf";
      }
      return {
        key: doc.s3Key,
        contentType,
        fileName: doc.name,
      };
    })
    .filter((item) => item.key);

  if (evidenceItems.length === 0) {
    return Promise.resolve({
      skipped: true,
      reason: "NO_EVIDENCE",
      claimId,
      overallStatus: "SKIPPED",
      overallVerdict: "UNCERTAIN",
      requiresReview: false,
      evidenceResults: [],
      message: "No images or PDF documents were submitted for evidence relevance analysis.",
    });
  }

  const boundedItems = evidenceItems.slice(0, 3);

  return postJson(ENDPOINTS.validateEvidence, {
    claimId,
    claimType: claim.claimType || "Auto",
    incidentDescription:
      claim.incidentDescription ||
      claim.description ||
      "Insurance claim submission evidence",
    evidence: boundedItems,
  });
}
