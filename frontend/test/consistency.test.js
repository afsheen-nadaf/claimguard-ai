import test from "node:test";
import assert from "node:assert/strict";
import { runConsistencyCheck } from "../src/lib/consistency.js";
import { interpretConsistency } from "../src/lib/screening.js";

test("consistency reports no uploaded files as skipped", async () => {
  const result = await runConsistencyCheck([]);

  assert.equal(result.status, "SKIPPED");
  assert.equal(result.totalFiles, 0);
  assert.equal(result.skipReason, "No files uploaded");
  assert.equal(interpretConsistency(result).state, "skipped");
});

test("uploaded documents without extraction data report actual file counts", async () => {
  const result = await runConsistencyCheck([
    { name: "claim.pdf", type: "application/pdf", s3Key: "claims/claim.pdf" },
    { name: "invoice.pdf", type: "application/pdf", s3Key: "claims/invoice.pdf" },
  ]);

  assert.equal(result.status, "SKIPPED");
  assert.equal(result.totalFiles, 2);
  assert.equal(result.documentsAnalyzed, 0);
  assert.match(result.skipReason, /2 files uploaded/);
  assert.match(result.skipReason, /0 documents with extracted data/);
});

test("two detected photos without a claim ID are incomplete, not skipped", async () => {
  const result = await runConsistencyCheck([
    { name: "damage-1.jpg", type: "image/jpeg", s3Key: "claims/damage-1.jpg" },
    { name: "damage-2.png", type: "image/png", s3Key: "claims/damage-2.png" },
  ]);

  assert.equal(result.status, "INCONCLUSIVE");
  assert.equal(result.totalFiles, 2);
  assert.equal(result.photosDetected, 2);
  assert.match(result.message, /claim ID is missing/);
  assert.equal(interpretConsistency(result).state, "inconclusive");
});

test("two extracted documents are compared and mismatches remain reviewable", async () => {
  const result = await runConsistencyCheck([
    {
      name: "claim.pdf",
      extractedData: { policyNumber: "POL-100" },
    },
    {
      name: "invoice.pdf",
      extractedData: { policyNumber: "POL-200" },
    },
  ]);

  assert.equal(result.status, "REVIEW");
  assert.equal(result.documentsAnalyzed, 2);
  assert.equal(result.summary.comparableFieldsChecked, 1);
  assert.equal(result.flags[0].code, "POLICY_NUMBER_MISMATCH");
});
