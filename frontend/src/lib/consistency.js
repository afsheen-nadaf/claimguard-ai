// Cross-document & cross-evidence consistency check.
//
// 1. Compares extracted fields across multiple documents (policy number,
//    incident date, claim amount, claim type, claimant name, claim number,
//    and duplicate invoice numbers).
// 2. When 2+ photos are uploaded, runs a Bedrock cross-evidence photo
//    comparison to check whether the photos appear visually consistent
//    with each other.
//
// All findings are investigation signals for human review, not proof of fraud.

import { postJson } from "../api/client.js";
import { ENDPOINTS } from "../api/config.js";

const COMPARABLE_FIELDS = [
  { field: "policyNumber", label: "Policy number", code: "POLICY_NUMBER_MISMATCH" },
  { field: "incidentDate", label: "Incident date", code: "DATE_MISMATCH" },
  { field: "claimAmountINR", label: "Claim amount", code: "AMOUNT_MISMATCH" },
  { field: "claimType", label: "Claim type", code: "CLAIM_TYPE_MISMATCH" },
  { field: "claimantName", label: "Claimant name", code: "CLAIMANT_MISMATCH" },
  { field: "claimNumber", label: "Claim number", code: "CLAIM_NUMBER_MISMATCH" },
];

const AMOUNT_TOLERANCE = 1.0;

function normalizeDate(value) {
  if (!value) return null;
  const str = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return String(value).trim();
}

function normalizeString(value) {
  return value ? String(value).trim().toLowerCase() : null;
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function valuesMatch(a, b, field) {
  if (field === "claimAmountINR") {
    const na = normalizeAmount(a);
    const nb = normalizeAmount(b);
    if (na === null || nb === null) return true;
    return Math.abs(na - nb) <= AMOUNT_TOLERANCE;
  }
  if (field === "incidentDate") {
    return normalizeDate(a) === normalizeDate(b);
  }
  return normalizeString(a) === normalizeString(b);
}

function formatValue(value, field) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "claimAmountINR") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `₹${n.toLocaleString("en-IN")}`;
  }
  return String(value);
}

function isImageFile(doc) {
  const type = String(doc?.type || doc?.contentType || "").toLowerCase();
  const names = [doc?.name, doc?.key, doc?.s3Key]
    .filter(Boolean)
    .map((name) => String(name).toLowerCase());
  return (
    ["image/jpeg", "image/jpg", "image/png"].includes(type) ||
    names.some((name) => /\.(jpe?g|png)$/.test(name))
  );
}

async function comparePhotosWithBedrock(claimId, claim, imageDocs) {
  if (!ENDPOINTS.validateEvidence) {
    return {
      status: "ERROR",
      reason: "Endpoint not configured",
      photosCompared: 0,
      verdict: "ERROR",
      summary: "Cross-evidence photo endpoint is not configured.",
      observations: [],
    };
  }

  const evidence = imageDocs.slice(0, 3).map((doc) => ({
    key: doc.s3Key || doc.key,
    contentType: doc.type || doc.contentType || "image/jpeg",
  }));

  const payload = await postJson(ENDPOINTS.validateEvidence, {
    claimId,
    claimType: claim?.claimType || "General",
    incidentDescription: claim?.description || claim?.incidentDescription || "",
    mode: "CROSS_EVIDENCE_PHOTOS",
    evidence,
  });

  if (payload?.evidenceComparison) {
    return payload.evidenceComparison;
  }

  const items = Array.isArray(payload?.evidenceResults) ? payload.evidenceResults : [];
  const hasMismatch = payload?.overallVerdict === "POTENTIAL_MISMATCH";
  return {
    status: hasMismatch ? "REVIEW" : "CONSISTENT",
    verdict: hasMismatch ? "POTENTIAL_MISMATCH" : payload?.overallVerdict || "CONSISTENT",
    photosCompared: items.length || evidence.length,
    summary:
      payload?.message ||
      (hasMismatch
        ? "Potential visual discrepancies observed across uploaded photos."
        : `Compared ${items.length || evidence.length} uploaded photos for visual consistency.`),
    observations: items.map((item) => ({
      fileName: item.fileName || item.key,
      verdict: item.verdict || "UNCERTAIN",
      detail: item.relevanceExplanation || item.detectedContent || "",
    })),
  };
}

export async function runConsistencyCheck(documents = [], claimId = null, claim = null) {
  const allDocs = Array.isArray(documents) ? documents : [];
  const withExtraction = allDocs.filter(
    (d) => d.extractedData && typeof d.extractedData === "object"
  );
  const detectedImages = allDocs.filter(isImageFile);
  const imageDocs = detectedImages.filter((d) => d.s3Key || d.key);

  const flags = [];
  let fieldsChecked = 0;

  if (withExtraction.length >= 2) {
    for (const { field, label, code } of COMPARABLE_FIELDS) {
      const pairs = withExtraction
        .map((d) => ({
          fileName: d.name,
          value: d.extractedData[field],
          documentType: d.extractedData.documentType,
        }))
        .filter((p) => p.value !== null && p.value !== undefined && p.value !== "");

      if (pairs.length < 2) continue;

      fieldsChecked++;

      const firstValue = pairs[0].value;
      const hasMismatch = pairs.some(
        (p) => !valuesMatch(p.value, firstValue, field)
      );

      if (hasMismatch) {
        const values = {};
        for (const p of pairs) {
          values[p.fileName] = formatValue(p.value, field);
        }

        flags.push({
          code,
          field,
          label,
          message: `${label} differs across uploaded documents`,
          documents: pairs.map((p) => p.fileName),
          values,
        });
      }
    }

    const invoiceEntries = withExtraction
      .map((d) => ({
        fileName: d.name,
        invoiceNumber: d.extractedData.invoiceNumber,
      }))
      .filter((p) => p.invoiceNumber);

    if (invoiceEntries.length >= 2) {
      const seen = {};
      for (const entry of invoiceEntries) {
        const key = String(entry.invoiceNumber).trim().toLowerCase();
        if (seen[key]) {
          flags.push({
            code: "DUPLICATE_INVOICE",
            field: "invoiceNumber",
            label: "Invoice number",
            message: `Invoice number "${entry.invoiceNumber}" appears in multiple uploaded documents`,
            documents: [seen[key], entry.fileName],
            values: {
              [seen[key]]: entry.invoiceNumber,
              [entry.fileName]: entry.invoiceNumber,
            },
          });
        } else {
          seen[key] = entry.fileName;
        }
      }
    }
  }

  let evidenceComparison = null;
  if (detectedImages.length >= 2 && imageDocs.length < 2) {
    evidenceComparison = {
      status: "ERROR",
      verdict: "ERROR",
      photosCompared: 0,
      summary: "Two photos were detected, but their storage keys are missing.",
      observations: [],
    };
  } else if (imageDocs.length >= 2 && !claimId) {
    evidenceComparison = {
      status: "ERROR",
      verdict: "ERROR",
      photosCompared: 0,
      summary: "Two photos were detected, but the claim ID is missing.",
      observations: [],
    };
  } else if (imageDocs.length >= 2) {
    try {
      evidenceComparison = await comparePhotosWithBedrock(claimId, claim, imageDocs);
      if (evidenceComparison?.verdict === "POTENTIAL_MISMATCH") {
        flags.push({
          code: "CROSS_EVIDENCE_PHOTO_MISMATCH",
          field: "evidencePhotos",
          label: "Cross-evidence photo comparison",
          message:
            evidenceComparison.summary ||
            "Potential visual inconsistency across uploaded photos",
          documents: imageDocs.map((d) => d.name),
          values: {},
        });
      }
    } catch (error) {
      evidenceComparison = {
        status: "ERROR",
        verdict: "UNCERTAIN",
        photosCompared: imageDocs.length,
        summary: error.message || "Could not compare photos via Bedrock.",
        observations: [],
      };
    }
  }

  const hasDocComparison = withExtraction.length >= 2;
  const hasPhotoComparison = Boolean(
    evidenceComparison && ["CONSISTENT", "REVIEW"].includes(evidenceComparison.status)
  );
  const comparisonError = evidenceComparison?.status === "ERROR";

  if (!hasDocComparison && !hasPhotoComparison) {
    const hasEnoughPotentialInputs =
      withExtraction.length >= 2 || detectedImages.length >= 2;
    const status = comparisonError || hasEnoughPotentialInputs ? "INCONCLUSIVE" : "SKIPPED";
    const skipReason = allDocs.length === 0
      ? "No files uploaded"
      : `${allDocs.length} file${allDocs.length === 1 ? "" : "s"} uploaded; ${withExtraction.length} document${withExtraction.length === 1 ? "" : "s"} with extracted data and ${detectedImages.length} photo${detectedImages.length === 1 ? "" : "s"} detected`;

    return {
      status,
      ...(status === "SKIPPED" ? { skipReason } : {}),
      documentsAnalyzed: withExtraction.length,
      totalDocuments: allDocs.length,
      totalFiles: allDocs.length,
      photosDetected: detectedImages.length,
      flags: [],
      summary: {
        documentsWithExtraction: withExtraction.length,
        comparableFieldsChecked: 0,
        mismatchesFound: 0,
      },
      evidenceComparison,
      message: comparisonError
        ? evidenceComparison.summary || "Photo comparison could not be completed."
        : status === "SKIPPED"
          ? "Not enough uploaded files with extractable document data or photos to compare."
          : "Consistency comparison could not be completed with the available file data.",
    };
  }

  const mismatchCount = flags.length;
  const status = mismatchCount > 0
    ? "REVIEW"
    : comparisonError
      ? "INCONCLUSIVE"
      : "CONSISTENT";

  return {
    status,
    documentsAnalyzed: withExtraction.length,
    totalDocuments: allDocs.length,
    totalFiles: allDocs.length,
    photosDetected: detectedImages.length,
    flags,
    summary: {
      documentsWithExtraction: withExtraction.length,
      comparableFieldsChecked: fieldsChecked,
      mismatchesFound: mismatchCount,
    },
    evidenceComparison,
    message:
      mismatchCount > 0
        ? `${mismatchCount} inconsistency${mismatchCount === 1 ? "" : "ies"} detected.`
        : comparisonError
          ? `Document comparison completed, but photo comparison could not be completed: ${evidenceComparison.summary || "No details were returned."}`
        : hasDocComparison && hasPhotoComparison
          ? `All ${fieldsChecked} comparable document field${fieldsChecked === 1 ? "" : "s"} and ${evidenceComparison.photosCompared} photos appear consistent.`
          : hasPhotoComparison
            ? `Compared ${evidenceComparison.photosCompared} uploaded photos — no visual inconsistencies flagged.`
            : `All ${fieldsChecked} comparable field${fieldsChecked === 1 ? "" : "s"} match across ${withExtraction.length} documents.`,
  };
}