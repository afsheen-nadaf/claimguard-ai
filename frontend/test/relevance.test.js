import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretRelevance } from "../src/lib/screening.js";
import { validateEvidenceRelevance } from "../src/api/claims.js";

describe("Evidence Relevance Helpers", () => {
  it("interprets RELEVANT response as pass without requiring review", () => {
    const raw = {
      claimId: "CLAIM-123",
      overallStatus: "COMPLETED",
      overallVerdict: "RELEVANT",
      requiresReview: false,
      evidenceResults: [
        {
          key: "incoming/CLAIM-123/bumper.jpg",
          fileName: "bumper.jpg",
          evidenceType: "image",
          status: "COMPLETED",
          verdict: "RELEVANT",
          confidenceScore: 0.94,
        },
        {
          key: "incoming/CLAIM-123/estimate.pdf",
          fileName: "estimate.pdf",
          evidenceType: "document",
          status: "COMPLETED",
          verdict: "RELEVANT",
          confidenceScore: 0.91,
        },
      ],
    };

    const interpreted = interpretRelevance(raw);
    assert.equal(interpreted.state, "pass");
    assert.equal(interpreted.kind, "completed");
    assert.equal(interpreted.overallVerdict, "RELEVANT");
    assert.equal(interpreted.requiresReview, false);
    assert.match(interpreted.label, /2 items relevant/);
  });

  it("interprets POTENTIAL_MISMATCH as review required", () => {
    const raw = {
      claimId: "CLAIM-123",
      overallStatus: "COMPLETED",
      overallVerdict: "POTENTIAL_MISMATCH",
      requiresReview: true,
      evidenceResults: [
        {
          key: "incoming/CLAIM-123/water.jpg",
          fileName: "water.jpg",
          evidenceType: "image",
          status: "COMPLETED",
          verdict: "POTENTIAL_MISMATCH",
          reasons: ["Shows water damage, not vehicle collision."],
        },
      ],
    };

    const interpreted = interpretRelevance(raw);
    assert.equal(interpreted.state, "review");
    assert.equal(interpreted.kind, "review");
    assert.equal(interpreted.overallVerdict, "POTENTIAL_MISMATCH");
    assert.equal(interpreted.requiresReview, true);
    assert.match(interpreted.label, /Potential mismatch/);
  });

  it("interprets UNCERTAIN or PARTIAL response as review required", () => {
    const raw = {
      claimId: "CLAIM-123",
      overallStatus: "PARTIAL",
      overallVerdict: "UNCERTAIN",
      requiresReview: true,
      evidenceResults: [
        {
          key: "incoming/CLAIM-123/bumper.jpg",
          status: "COMPLETED",
          verdict: "RELEVANT",
        },
        {
          key: "incoming/CLAIM-123/corrupt.pdf",
          status: "ERROR",
          verdict: "UNCERTAIN",
        },
      ],
    };

    const interpreted = interpretRelevance(raw);
    assert.equal(interpreted.state, "review");
    assert.equal(interpreted.overallVerdict, "UNCERTAIN");
    assert.equal(interpreted.requiresReview, true);
  });

  it("interprets skipped response when no files were submitted", () => {
    const raw = {
      skipped: true,
      message: "No evidence files submitted",
    };

    const interpreted = interpretRelevance(raw);
    assert.equal(interpreted.state, "pass");
    assert.equal(interpreted.kind, "skipped");
    assert.equal(interpreted.requiresReview, false);
  });

  it("validateEvidenceRelevance preserves claimId in payload and maps incoming/{claimId}/ keys", async () => {
    const claimId = "CG-1793727402258-20387251";
    const claim = { claimType: "Auto", incidentDescription: "Rear-ended collision" };
    const documents = [
      {
        name: "rear_bumper.jpg",
        s3Key: `incoming/${claimId}/ee692087b3654f7cb586d7a68d28cc2b.jpg`,
        type: "image/jpeg",
      },
      {
        name: "repair_estimate.pdf",
        s3Key: `incoming/${claimId}/1234567890abcdef1234567890abcdef.pdf`,
        type: "application/pdf",
      },
    ];

    const originalFetch = globalThis.fetch;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            claimId,
            overallStatus: "COMPLETED",
            overallVerdict: "RELEVANT",
            requiresReview: false,
            evidenceResults: [],
          }),
      };
    };

    try {
      await validateEvidenceRelevance(claimId, claim, documents);
      assert.equal(capturedBody.claimId, claimId);
      assert.equal(capturedBody.claimType, "Auto");
      assert.equal(capturedBody.evidence.length, 2);
      assert.equal(
        capturedBody.evidence[0].key,
        `incoming/${claimId}/ee692087b3654f7cb586d7a68d28cc2b.jpg`
      );
      assert.equal(
        capturedBody.evidence[1].key,
        `incoming/${claimId}/1234567890abcdef1234567890abcdef.pdf`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
