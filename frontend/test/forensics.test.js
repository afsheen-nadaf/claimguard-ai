import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractForensicsOverview,
  normalizeMetadata,
  normalizeCompression,
  normalizeQuality,
  normalizeAiGeneration,
  normalizeReview,
  FINDING_DESCRIPTIONS,
} from "../src/lib/forensics.js";
import { interpretDuplicate, interpretForensics } from "../src/lib/screening.js";

describe("Forensics Data Helpers", () => {
  it("derives overview when no raw forensics data exists (current production state)", () => {
    const record = {
      id: "CG-TEST-001",
      documents: [
        { name: "damage.jpg", size: 102400, type: "image/jpeg" },
        { name: "police-report.pdf", size: 204800, type: "application/pdf" },
      ],
      checks: {
        duplicate: {
          status: "done",
          result: {
            state: "pass",
            matches: [],
            imageMatches: [],
          },
        },
      },
    };

    const overview = extractForensicsOverview(record);
    assert.equal(overview.imagesSubmitted, 1);
    assert.equal(overview.imagesAnalyzed, 0);
    assert.equal(overview.metadataStatus, "Not available (Awaiting backend integration)");
    assert.equal(overview.compressionStatus, "Not available (Awaiting backend integration)");
    assert.equal(overview.qualityStatus, "Not available (Awaiting backend integration)");
    assert.equal(overview.duplicateStatus, "No visual duplicates found");
    assert.equal(overview.hasRawData, false);
  });

  it("derives overview with duplicate image matches flagged", () => {
    const record = {
      id: "CG-TEST-002",
      documents: [{ name: "front-bumper.png", size: 500000, type: "image/png" }],
      checks: {
        duplicate: {
          status: "done",
          result: {
            state: "review",
            matches: [],
            imageMatches: [
              {
                claimId: "CG-HIST-999",
                similarityPercent: 100,
                hammingDistance: 0,
                source: "IMAGE_HASH",
              },
            ],
          },
        },
      },
    };

    const overview = extractForensicsOverview(record);
    assert.equal(overview.imagesSubmitted, 1);
    assert.match(overview.duplicateStatus, /Review required \(1 visual match\)/);
  });

  it("normalizes metadata fields from metadata.py specification", () => {
    const raw = {
      fileName: "vehicle_damage.jpg",
      fileSize: 2048576,
      fileExtension: "JPG",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      imageFormat: "JPEG",
      width: 4032,
      height: 3024,
      megapixels: 12.19,
      cameraMake: "Apple",
      cameraModel: "iPhone 14 Pro",
      captureTimestamp: "2026-10-14 15:30:22",
      software: "16.5",
      hasGps: true,
      findings: ["CAMERA_MAKE_MISSING"],
    };

    const normalized = normalizeMetadata(raw, null);
    assert.equal(normalized.fileName, "vehicle_damage.jpg");
    assert.equal(normalized.sha256, raw.sha256);
    assert.equal(normalized.cameraMake, "Apple");
    assert.equal(normalized.cameraModel, "iPhone 14 Pro");
    assert.equal(normalized.megapixels, "12.19 MP");
    assert.equal(normalized.hasGps, true);
    assert.deepEqual(normalized.warnings, ["CAMERA_MAKE_MISSING"]);
    assert.equal(normalized.findings[0].code, "CAMERA_MAKE_MISSING");
  });

  it("normalizes compression telemetry from compression_analysis.py specification", () => {
    const raw = {
      imageFormat: "JPEG",
      quantizationTableCount: 2,
      quantizationTableCoefficientCount: 128,
      minCoefficient: 2,
      maxCoefficient: 120,
      meanCoefficient: 24.5,
      encodingProcess: "Baseline DCT, Huffman coding",
      ycbcrSubsampling: "YCbCr4:2:0 (2 2)",
      bitsPerSample: 8,
      fileType: "JPEG / JFIF",
      warnings: ["HIGH_COMPRESSION"],
    };

    const normalized = normalizeCompression(raw);
    assert.equal(normalized.quantizationTableCount, 2);
    assert.equal(normalized.minCoefficient, 2);
    assert.equal(normalized.maxCoefficient, 120);
    assert.equal(normalized.meanCoefficient, "24.50");
    assert.equal(normalized.encodingProcess, "Baseline DCT, Huffman coding");
    assert.equal(normalized.ycbcrSubsampling, "YCbCr4:2:0 (2 2)");
    assert.equal(normalized.hasQuantizationTables, true);
    assert.deepEqual(normalized.warnings, ["HIGH_COMPRESSION"]);
  });

  it("normalizes quality metrics from image_quality.py specification", () => {
    const raw = {
      width: 1920,
      height: 1080,
      megapixels: 2.07,
      blurScore: 145.2,
      brightnessScore: 112.4,
      contrastScore: 54.1,
      noiseEstimate: 3.12,
      findings: ["POSSIBLY_BLURRY", "LOW_CONTRAST"],
    };

    const normalized = normalizeQuality(raw);
    assert.equal(normalized.dimensions, "1920 × 1080");
    assert.equal(normalized.megapixels, "2.07 MP");
    assert.equal(normalized.blurScore, 145.2);
    assert.equal(normalized.brightnessScore, 112.4);
    assert.equal(normalized.contrastScore, 54.1);
    assert.equal(normalized.noiseEstimate, 3.12);
    assert.deepEqual(normalized.warnings, ["POSSIBLY_BLURRY", "LOW_CONTRAST"]);
    assert.equal(normalized.findings[0].code, "POSSIBLY_BLURRY");
    assert.equal(normalized.findings[1].code, "LOW_CONTRAST");
  });

  it("normalizes Smaug AI-generation detection output when completed", () => {
    const raw = {
      status: "COMPLETED",
      result: {
        model: "abacusai/Smaug-AI-Image-Detector",
        aiGeneratedScore: 0.842512,
        aiGeneratedPercentage: 84.25,
        interpretation: "Higher AI-generation score",
        disclaimer: "This is an AI-generation screening score.",
      },
    };

    const normalized = normalizeAiGeneration(raw);
    assert.equal(normalized.status, "COMPLETED");
    assert.equal(normalized.isCompleted, true);
    assert.equal(normalized.model, "abacusai/Smaug-AI-Image-Detector");
    assert.equal(normalized.score, 0.842512);
    assert.equal(normalized.percentage, 84.25);
    assert.equal(normalized.interpretation, "Higher AI-generation score");
    assert.equal(normalized.disclaimer, "This is an AI-generation screening score.");
  });

  it("does not report score of 0% when Smaug is unavailable or returns an error", () => {
    const rawError = {
      status: "ERROR",
      error: "Hugging Face ZeroGPU Space timed out",
    };

    const normalizedError = normalizeAiGeneration(rawError);
    assert.equal(normalizedError.status, "ERROR");
    assert.equal(normalizedError.isCompleted, false);
    assert.equal(normalizedError.score, null);
    assert.equal(normalizedError.percentage, null);
    assert.equal(normalizedError.error, "Hugging Face ZeroGPU Space timed out");

    const normalizedEmpty = normalizeAiGeneration(null);
    assert.equal(normalizedEmpty, null);
  });

  it("normalizes analyst review recommendations for flagged images", () => {
    const raw = {
      required: true,
      priority: "NORMAL",
      reasons: [
        "AI-generation screening score exceeded the configured review threshold.",
        "metadata: Software metadata tag indicates image editing.",
      ],
      coverageWarnings: ["AI-generation analysis was unavailable or incomplete."],
      limitations: [
        "AI-generation screening may miss localized edits in otherwise genuine photographs.",
      ],
    };

    const normalized = normalizeReview(raw);
    assert.equal(normalized.required, true);
    assert.equal(normalized.priority, "NORMAL");
    assert.equal(normalized.reasons.length, 2);
    assert.equal(normalized.coverageWarnings.length, 1);
    assert.equal(normalized.limitations.length, 1);
  });

  it("normalizes neutral status when review is not required", () => {
    const normalized = normalizeReview({ required: false });
    assert.equal(normalized.required, false);
    assert.equal(normalized.priority, "NONE");
    assert.deepEqual(normalized.reasons, []);
  });

  it("interpretForensics flags review state when images require human review", () => {
    const apiResponse = {
      claimId: "CLAIM-123",
      analysisStatus: "COMPLETED",
      imagesSubmitted: 1,
      analysesCompleted: 4,
      analysesWithErrors: 0,
      images: [
        {
          fileName: "bumper.jpg",
          s3Key: "incoming/CLAIM-123/bumper.jpg",
          fileSizeBytes: 204800,
          analyses: {},
          review: {
            required: true,
            priority: "NORMAL",
            reasons: ["AI-generation screening score exceeded threshold."],
            coverageWarnings: [],
            limitations: [],
          },
        },
      ],
    };

    const interpreted = interpretForensics(apiResponse);
    assert.equal(interpreted.state, "review");
    assert.equal(interpreted.kind, "review");
    assert.equal(interpreted.hasReviewRequired, true);
    assert.equal(interpreted.flaggedCount, 1);
    assert.match(interpreted.label, /Human review recommended/);
  });

  it("interpretForensics marks pass when completed and no review flags exist", () => {
    const apiResponse = {
      claimId: "CLAIM-123",
      analysisStatus: "COMPLETED",
      imagesSubmitted: 1,
      analysesCompleted: 4,
      analysesWithErrors: 0,
      images: [
        {
          fileName: "car.jpg",
          review: { required: false },
        },
      ],
    };

    const interpreted = interpretForensics(apiResponse);
    assert.equal(interpreted.state, "pass");
    assert.equal(interpreted.kind, "completed");
    assert.equal(interpreted.hasReviewRequired, false);
  });

  it("interpretForensics handles PARTIAL, FAILED, and SKIPPED response states", () => {
    const partialWithReview = {
      analysisStatus: "PARTIAL",
      imagesSubmitted: 2,
      analysesCompleted: 3,
      analysesWithErrors: 1,
      images: [
        { fileName: "pic1.jpg", review: { required: true } },
        { fileName: "pic2.jpg", review: { required: false } },
      ],
    };
    const interpretedPartialReview = interpretForensics(partialWithReview);
    assert.equal(interpretedPartialReview.state, "review");
    assert.equal(interpretedPartialReview.kind, "review");
    assert.equal(interpretedPartialReview.flaggedCount, 1);

    const partialNoReview = {
      analysisStatus: "PARTIAL",
      imagesSubmitted: 1,
      analysesCompleted: 3,
      analysesWithErrors: 1,
      images: [{ fileName: "pic1.jpg", review: { required: false } }],
    };
    const interpretedPartialNoReview = interpretForensics(partialNoReview);
    assert.equal(interpretedPartialNoReview.state, "inconclusive");
    assert.equal(interpretedPartialNoReview.kind, "partial");

    const failed = {
      analysisStatus: "FAILED",
      analysesWithErrors: 4,
    };
    const interpretedFailed = interpretForensics(failed);
    assert.equal(interpretedFailed.state, "inconclusive");
    assert.equal(interpretedFailed.kind, "failed");

    const skipped = {
      skipped: true,
      message: "No JPG, JPEG or PNG images were uploaded for this claim.",
    };
    const interpretedSkipped = interpretForensics(skipped);
    assert.equal(interpretedSkipped.state, "pass");
    assert.equal(interpretedSkipped.kind, "skipped");
  });

  it("extractForensicsOverview properly tracks module statuses and review indicators", () => {
    const record = {
      id: "CG-TEST-003",
      documents: [{ name: "front.jpg", size: 102400, type: "image/jpeg" }],
      checks: {
        forensics: {
          status: "done",
          raw: {
            analysisStatus: "COMPLETED",
            imagesSubmitted: 1,
            analysesCompleted: 4,
            analysesWithErrors: 0,
            images: [
              {
                fileName: "front.jpg",
                s3Key: "incoming/CG-TEST-003/front.jpg",
                analyses: {
                  aiGeneration: { status: "COMPLETED", result: { aiGeneratedScore: 0.85 } },
                  metadata: { status: "COMPLETED", result: {} },
                  compression: { status: "COMPLETED", result: {} },
                  imageQuality: { status: "COMPLETED", result: {} },
                },
                review: { required: true, reasons: ["High AI-generation score"] },
              },
            ],
          },
        },
      },
    };

    const overview = extractForensicsOverview(record);
    assert.equal(overview.analysisState, "review");
    assert.equal(overview.analysisStateLabel, "Review recommended");
    assert.equal(overview.aiGenerationStatus, "Completed");
    assert.equal(overview.metadataStatus, "Completed");
    assert.equal(overview.compressionStatus, "Completed");
    assert.equal(overview.qualityStatus, "Completed");
    assert.equal(overview.hasReviewRequired, true);
    assert.equal(overview.flaggedImagesCount, 1);
  });

  it("contains descriptive analyst copy for all diagnostic finding codes", () => {
    const expectedCodes = [
      "EXIF_NOT_PRESENT",
      "CAMERA_MAKE_MISSING",
      "CAPTURE_TIME_UNAVAILABLE",
      "LOW_RESOLUTION",
      "POSSIBLY_BLURRY",
      "LOW_BRIGHTNESS",
      "HIGH_BRIGHTNESS",
      "LOW_CONTRAST",
    ];

    for (const code of expectedCodes) {
      assert.ok(FINDING_DESCRIPTIONS[code], `Missing description for ${code}`);
      assert.ok(typeof FINDING_DESCRIPTIONS[code] === "string");
    }
  });

  it("interpretDuplicate properly normalizes traditional and image matches", () => {
    const apiResponse = {
      duplicateStatus: "REVIEW",
      matchType: "EXACT_POLICY_DATE",
      matchedClaimId: "CG-2026-0012",
      matches: [
        {
          claimId: "CG-2026-0012",
          policyNumber: "POL-7712",
          incidentDate: "2026-09-12",
          claimAmountINR: 45000,
          source: "DATABASE",
          matchType: "EXACT_POLICY_DATE",
        },
      ],
      imageMatches: [
        {
          claimId: "CG-2025-8831",
          matchedImageId: "img_9a12c4",
          uploadedImageKey: "uploads/cg-test/damage.jpg",
          hammingDistance: 0,
          similarityPercent: 100,
          source: "IMAGE_HASH",
        },
      ],
    };

    const result = interpretDuplicate(apiResponse);
    assert.equal(result.state, "review");
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].claimId, "CG-2026-0012");
    assert.equal(result.matches[0].matchType, "EXACT_POLICY_DATE");

    assert.equal(result.imageMatches.length, 1);
    assert.equal(result.imageMatches[0].claimId, "CG-2025-8831");
    assert.equal(result.imageMatches[0].similarityPercent, 100);
    assert.equal(result.imageMatches[0].hammingDistance, 0);
    assert.equal(result.imageMatches[0].matchedImageId, "img_9a12c4");
    assert.equal(result.imageMatches[0].uploadedImageKey, "uploads/cg-test/damage.jpg");
  });
});
