// Cross-document consistency check.
//
// Compares fields extracted from multiple uploaded documents to detect
// inconsistencies. For example: if the claim form says the incident date
// is 15 Oct but the invoice says 20 Oct, that's a DATE_MISMATCH flag.
//
// This is a pure frontend check — no backend endpoint needed. It operates
// on the extractedData that Bedrock already returned for each document.
//
// All findings are investigation signals for human review, not proof of fraud.

// Fields to compare across documents. Each entry maps the extractedData
// field name to a human-readable label and the flag code to raise on mismatch.
const COMPARABLE_FIELDS = [
  { field: "policyNumber", label: "Policy number", code: "POLICY_NUMBER_MISMATCH" },
  { field: "incidentDate", label: "Incident date", code: "DATE_MISMATCH" },
  { field: "claimAmountINR", label: "Claim amount", code: "AMOUNT_MISMATCH" },
  { field: "claimType", label: "Claim type", code: "CLAIM_TYPE_MISMATCH" },
  { field: "claimantName", label: "Claimant name", code: "CLAIMANT_MISMATCH" },
  { field: "claimNumber", label: "Claim number", code: "CLAIM_NUMBER_MISMATCH" },
];

// Tolerance for amount comparison (₹1 to handle rounding differences).
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

/**
 * Run the cross-document consistency check.
 *
 * @param {Array} documents — the documents array from the screening payload.
 *   Each document should have: { name, extractedData, ... }
 *   extractedData is the object returned by the Bedrock extraction endpoint.
 *
 * @returns {Object} — {
 *   status: "CONSISTENT" | "REVIEW" | "SKIPPED",
 *   documentsAnalyzed: number,
 *   totalDocuments: number,
 *   flags: [{ code, field, label, message, documents, values }],
 *   summary: { documentsWithExtraction, comparableFieldsChecked, mismatchesFound },
 *   message: string
 * }
 */
export function runConsistencyCheck(documents) {
  const withExtraction = (documents || []).filter(
    (d) => d.extractedData && typeof d.extractedData === "object"
  );

  if (withExtraction.length < 2) {
    return {
      status: "SKIPPED",
      documentsAnalyzed: withExtraction.length,
      totalDocuments: (documents || []).length,
      flags: [],
      summary: {
        documentsWithExtraction: withExtraction.length,
        comparableFieldsChecked: 0,
        mismatchesFound: 0,
      },
      message:
        withExtraction.length === 0
          ? "No documents with extracted data — cross-document comparison was not performed."
          : "Only one document with extracted data — cross-document comparison requires at least two.",
    };
  }

  const flags = [];
  let fieldsChecked = 0;

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

  // Check for duplicate invoice numbers within this upload set.
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

  const mismatchCount = flags.length;

  return {
    status: mismatchCount > 0 ? "REVIEW" : "CONSISTENT",
    documentsAnalyzed: withExtraction.length,
    totalDocuments: documents.length,
    flags,
    summary: {
      documentsWithExtraction: withExtraction.length,
      comparableFieldsChecked: fieldsChecked,
      mismatchesFound: mismatchCount,
    },
    message:
      mismatchCount > 0
        ? `${mismatchCount} inconsistency${mismatchCount === 1 ? "" : "ies"} found across ${withExtraction.length} documents.`
        : `All ${fieldsChecked} comparable field${fieldsChecked === 1 ? "" : "s"} match across ${withExtraction.length} documents.`,
  };
}
