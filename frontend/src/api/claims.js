import { ENDPOINTS, UPLOAD_RULES } from "./config.js";
import { ApiError, getJson, postJson, putToPresignedUrl } from "./client.js";

export function fetchClaimHistory(limit = 50, cursor = null, claimId = null) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (claimId) params.set("claimId", claimId);
  return getJson(`${ENDPOINTS.fetchHistory}?${params.toString()}`);
}

export function persistScreeningResult(claimId, checkKey, checkResult) {
  return postJson(ENDPOINTS.saveResults, { claimId, checkKey, checkResult });
}

export function fetchDocumentViewUrl(claimId, key) {
  const params = new URLSearchParams({ claimId, key });
  const baseUrl = ENDPOINTS.fetchHistory.replace(/\/claims\/history$/, "/claims/document-url");
  return getJson(`${baseUrl}?${params.toString()}`);
}
// ---------------------------------------------------------------------------
// Backend pipeline (Step Functions). Used when VITE_USE_PIPELINE=true.
// ---------------------------------------------------------------------------

export function submitClaim(claimId, claim, documents = []) {
  return postJson(ENDPOINTS.submit, {
    claimId,
    claimantName: claim.claimantName || "",
    policyNumber: claim.policyNumber,
    claimType: claim.claimType,
    incidentDate: claim.incidentDate,
    claimAmountINR: claim.claimAmountINR,
    description: claim.description || claim.incidentDescription || "",
    documents: documents
      .filter((doc) => doc.s3Key)
      .map((doc) => ({
        key: doc.s3Key,
        contentType: doc.type || doc.contentType || "",
        name: doc.name || "",
      })),
  });
}

export function fetchClaimStatus(claimId) {
  return getJson(`${ENDPOINTS.status}?${new URLSearchParams({ claimId })}`);
}

// Polls until the pipeline leaves RUNNING. Returns the final status object.
export async function waitForPipeline(
  claimId,
  { intervalMs = 3000, timeoutMs = 600000 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await fetchClaimStatus(claimId);
    if (status.status !== "RUNNING") return status;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for screening to finish.");
}

// ---------------------------------------------------------------------------
// Uploads and the original per-check endpoints (browser-driven flow)
// ---------------------------------------------------------------------------

export function resolveContentType(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();

  return file.type || UPLOAD_RULES.extensionToType[extension] || null;
}

// Request a presigned URL, upload directly to S3,
// and return the S3 object key. When claimId is supplied the object is
// stored under incoming/{claimId}/, which the evidence-relevance
// endpoint requires for path-prefix validation.
export async function uploadDocument(file, onProgress, claimId) {
  const contentType = resolveContentType(file);

  if (!contentType) {
    throw new ApiError("Unsupported file type.", {
      kind: "parse",
    });
  }

  const presignBody = {
    filename: file.name,
    contentType,
    fileSize: file.size,
  };

  if (claimId) {
    presignBody.claimId = claimId;
  }

  const presign = await postJson(ENDPOINTS.presign, presignBody);

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
    onProgress,
    presign.requiredHeaders || {}
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
    claimantName: claim.claimantName || "",
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
    claimantName: claim.claimantName || "",
    policyNumber: claim.policyNumber,
    claimType: claim.claimType,
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

  const boundedKeys = imageKeys.slice(0, UPLOAD_RULES.maxImages);

  return postJson(ENDPOINTS.analyzeImage, {
    claimId,
    imageKeys: boundedKeys,
  });
}

// Send an uploaded document's S3 key to the Bedrock extraction Lambda.
// Returns structured fields extracted from the document (policy number,
// claim type, dates, amounts, etc.) plus missing/uncertain field lists.
// The backend treats document contents as untrusted data, never instructions.
export function extractDocument(key, contentType) {
  return postJson(ENDPOINTS.extractDocument, {
    key,
    contentType,
  });
}

// Submit uploaded evidence (images + PDFs) to the Bedrock evidence-relevance
// Lambda. The backend assesses whether each item visually/contextually
// supports the reported claim type and incident narrative.
// Evidence keys MUST live under incoming/{claimId}/ for the backend's
// path-prefix validation, so uploadDocument must be called with claimId.
export function validateEvidence(claimId, claim, documents = []) {
  const evidence = documents
    .filter((doc) => doc.s3Key)
    .slice(0, 3)
    .map((doc) => ({
      key: doc.s3Key,
      contentType: doc.type || doc.contentType || "application/octet-stream",
    }));

  if (evidence.length === 0) {
    return Promise.resolve({
      skipped: true,
      reason: "NO_EVIDENCE",
      claimId,
      overallStatus: "SKIPPED",
      overallVerdict: "UNCERTAIN",
      requiresReview: false,
      evidenceResults: [],
      message: "No uploaded evidence was available for relevance validation.",
    });
  }

  return postJson(ENDPOINTS.validateEvidence, {
    claimId,
    claimType: claim.claimType,
    incidentDescription: claim.description || claim.incidentDescription || "",
    evidence,
  });
}