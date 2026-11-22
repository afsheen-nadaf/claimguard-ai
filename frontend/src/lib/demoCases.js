// Pre-seeded demo cases for live presentations.
//
// Each case contains a complete claim + documents + mock screening responses
// for all 6 checks. loadDemoCase() in useScreenings creates a record with all
// checks set to "done" immediately — no API calls, no uploads, no network
// dependency. This guarantees a smooth demo even if AWS or Bedrock is slow.
//
// The mock responses match the exact contract each backend Lambda returns,
// so the real interpret functions process them correctly.
//
// All data is fictional. No real policyholders, claims, or providers.

export const DEMO_CASES = [
  {
    id: "valid-auto",
    icon: "checkCircle",
    name: "Valid auto claim",
    description: "Rear-end collision with matching invoice and photo. All checks pass.",
    expectedOutcome: "All clear",
    claimId: "CG-DEMO-001",
    claim: {
      claimType: "Auto",
      policyNumber: "POL-AU-100001",
      incidentDate: "2026-01-05",
      claimAmountINR: 125000,
      location: "Bengaluru, Karnataka",
      description:
        "Rear-end collision while stopped at a traffic signal. Front bumper and headlight damaged. No injuries reported.",
    },
    documents: [
      {
        name: "repair-invoice.pdf",
        size: 245000,
        type: "application/pdf",
        s3Key: "demo/repair-invoice.pdf",
        extractedData: {
          documentType: "invoice",
          claimantName: "Rahul Verma",
          policyNumber: "POL-AU-100001",
          claimNumber: "CG-2026-0001",
          claimType: "Auto",
          incidentDate: "2026-01-05",
          claimAmountINR: 125000,
          providerName: "Metro Panel Works",
          invoiceNumber: "INV-2026-5001",
          incidentLocation: "MG Road, Bengaluru",
          incidentDescription: "Rear-end collision at traffic signal",
          missingFields: [],
          uncertainFields: [],
          extractionNotes: [],
        },
      },
      {
        name: "damage-photo.jpg",
        size: 1850000,
        type: "image/jpeg",
        s3Key: "demo/damage-photo.jpg",
        extractedData: null,
      },
    ],
    checks: {
      policy: {
        policyNumber: "POL-AU-100001",
        validationStatus: "PASS",
        checks: {
          policyExists: true,
          policyStatus: "PASS",
          coverageDates: "PASS",
          claimType: "PASS",
          coverageLimit: "PASS",
        },
        flags: [],
        note: "These are screening findings, not a determination of fraud or a final coverage decision.",
      },
      duplicate: {
        duplicateStatus: "NO_MATCH",
        matchType: null,
        message: "No configured duplicate match found. Claim registered.",
        matches: [],
        imageMatches: [],
        imageMatchStatus: "NO_MATCH",
        registeredClaimId: "CG-DEMO-001",
        note: "A matching record is a review signal, not proof of fraud.",
      },
      outlier: {
        status: "NOT_OUTLIER",
        claimType: "Auto",
        claimAmountINR: 125000,
        sampleSize: 8,
        method: "ROBUST_Z_SCORE",
        threshold: 3.5,
        medianINR: 47500,
        madINR: 18000,
        q1INR: 43625,
        q3INR: 68000,
        lowerBoundINR: -45902.52,
        upperBoundINR: 140902.52,
        robustZScore: 2.904,
        message:
          "Claim amount is within the statistical bounds for comparable reference claims.",
        disclaimer: "An outlier is a screening signal, not proof of fraud.",
      },
      forensics: {
        claimId: "CG-DEMO-001",
        analysisStatus: "COMPLETED",
        imagesSubmitted: 1,
        analysesCompleted: 4,
        analysesWithErrors: 0,
        images: [
          {
            fileName: "damage-photo.jpg",
            s3Key: "demo/damage-photo.jpg",
            fileSizeBytes: 1850000,
            analyses: {
              metadata: {
                status: "COMPLETED",
                result: {
                  file_name: "damage-photo.jpg",
                  file_size_bytes: 1850000,
                  file_extension: ".jpg",
                  sha256: "a1b2c3d4e5f6",
                  image_properties: {
                    format: "JPEG",
                    width: 1920,
                    height: 1080,
                    mode: "RGB",
                    megapixels: 2.07,
                  },
                  camera_make: "Apple",
                  camera_model: "iPhone 14",
                  capture_timestamp: "2026:01:05 14:30:00",
                  software: null,
                  gps_metadata_present: true,
                  metadata_indicators: {
                    exif_present: true,
                    camera_make_present: true,
                    camera_model_present: true,
                    datetime_present: true,
                    software_field_present: false,
                    gps_metadata_present: true,
                  },
                  findings: [],
                },
              },
              compression: {
                status: "COMPLETED",
                result: {
                  format: "JPEG",
                  quantization_tables: { "0": [16, 11, 10], "1": [17, 18, 24] },
                  chroma_subsampling: "4:2:0",
                  findings: [],
                },
              },
              imageQuality: {
                status: "COMPLETED",
                result: {
                  resolution: { width: 1920, height: 1080, megapixels: 2.07 },
                  sharpness: { laplacian_variance: 285.3, assessment: "sharp" },
                  illumination: { mean_brightness: 128.5, assessment: "well_exposed" },
                  contrast: { std_dev: 52.3, assessment: "good_contrast" },
                  noise: { estimated: 3.2, assessment: "low_noise" },
                  findings: [],
                },
              },
              aiGeneration: {
                status: "COMPLETED",
                result: {
                  model: "abacusai/Smaug-AI-Image-Detector",
                  aiGeneratedScore: 0.08,
                  aiGeneratedPercentage: 8.0,
                  interpretation:
                    "Image shows low probability of AI generation.",
                },
              },
            },
            review: {
              required: false,
              priority: "NONE",
              reasons: [],
              coverageWarnings: [],
              limitations: [
                "AI-generation screening may miss localized edits in otherwise genuine photographs.",
                "No flags detected does not establish image authenticity.",
              ],
            },
          },
        ],
      },
      evidence: {
        claimId: "CG-DEMO-001",
        overallStatus: "COMPLETED",
        overallVerdict: "RELEVANT",
        requiresReview: false,
        evidenceResults: [
          {
            key: "demo/repair-invoice.pdf",
            fileName: "repair-invoice.pdf",
            evidenceType: "document",
            contentType: "application/pdf",
            status: "COMPLETED",
            verdict: "RELEVANT",
            detectedContent:
              "The document is a repair invoice from Metro Panel Works for front bumper and headlight repair, totaling ₹1,25,000. The invoice references policy POL-AU-100001 and incident date 5 January 2026.",
            relevanceExplanation:
              "The invoice describes repairs consistent with a rear-end collision claim. The policy number and incident date match the submitted claim details.",
            reasons: [],
            confidenceScore: 0.92,
          },
          {
            key: "demo/damage-photo.jpg",
            fileName: "damage-photo.jpg",
            evidenceType: "image",
            contentType: "image/jpeg",
            status: "COMPLETED",
            verdict: "RELEVANT",
            detectedContent:
              "The image shows a vehicle with visible damage to the front bumper and right headlight assembly, consistent with a rear-end collision.",
            relevanceExplanation:
              "The visible damage in the photograph corresponds to the reported incident type and location.",
            reasons: [],
            confidenceScore: 0.88,
          },
        ],
        disclaimer:
          "Evidence relevance screening is an automated heuristic and does not establish image or document authenticity or prove fraud.",
      },
    },
  },

  {
    id: "tampered-image",
    icon: "alert",
    name: "Tampered image claim",
    description: "AI-generated damage photo with no EXIF metadata. Forensics flags AI generation.",
    expectedOutcome: "Forensics review",
    claimId: "CG-DEMO-002",
    claim: {
      claimType: "Auto",
      policyNumber: "POL-AU-100003",
      incidentDate: "2026-02-10",
      claimAmountINR: 85000,
      location: "Mumbai, Maharashtra",
      description:
        "Side collision at intersection. Right door and fender damaged. Vehicle was moving at low speed.",
    },
    documents: [
      {
        name: "ai-damage.jpg",
        size: 2400000,
        type: "image/jpeg",
        s3Key: "demo/ai-damage.jpg",
        extractedData: null,
      },
    ],
    checks: {
      policy: {
        policyNumber: "POL-AU-100003",
        validationStatus: "PASS",
        checks: {
          policyExists: true,
          policyStatus: "PASS",
          coverageDates: "PASS",
          claimType: "PASS",
          coverageLimit: "PASS",
        },
        flags: [],
        note: "These are screening findings, not a determination of fraud or a final coverage decision.",
      },
      duplicate: {
        duplicateStatus: "NO_MATCH",
        matchType: null,
        message: "No configured duplicate match found. Claim registered.",
        matches: [],
        imageMatches: [],
        imageMatchStatus: "NO_MATCH",
        registeredClaimId: "CG-DEMO-002",
        note: "A matching record is a review signal, not proof of fraud.",
      },
      outlier: {
        status: "NOT_OUTLIER",
        claimType: "Auto",
        claimAmountINR: 85000,
        sampleSize: 8,
        method: "ROBUST_Z_SCORE",
        threshold: 3.5,
        medianINR: 47500,
        madINR: 18000,
        q1INR: 43625,
        q3INR: 68000,
        lowerBoundINR: -45902.52,
        upperBoundINR: 140902.52,
        robustZScore: 1.39,
        message:
          "Claim amount is within the statistical bounds for comparable reference claims.",
        disclaimer: "An outlier is a screening signal, not proof of fraud.",
      },
      forensics: {
        claimId: "CG-DEMO-002",
        analysisStatus: "COMPLETED",
        imagesSubmitted: 1,
        analysesCompleted: 4,
        analysesWithErrors: 0,
        images: [
          {
            fileName: "ai-damage.jpg",
            s3Key: "demo/ai-damage.jpg",
            fileSizeBytes: 2400000,
            analyses: {
              metadata: {
                status: "COMPLETED",
                result: {
                  file_name: "ai-damage.jpg",
                  file_size_bytes: 2400000,
                  file_extension: ".jpg",
                  sha256: "f7e8d9c0b1a2",
                  image_properties: {
                    format: "JPEG",
                    width: 2048,
                    height: 2048,
                    mode: "RGB",
                    megapixels: 4.19,
                  },
                  camera_make: null,
                  camera_model: null,
                  capture_timestamp: null,
                  software: null,
                  gps_metadata_present: false,
                  metadata_indicators: {
                    exif_present: false,
                    camera_make_present: false,
                    camera_model_present: false,
                    datetime_present: false,
                    software_field_present: false,
                    gps_metadata_present: false,
                  },
                  findings: [
                    { code: "EXIF_NOT_PRESENT", severity: "info", message: "No readable EXIF metadata was found." },
                    { code: "CAMERA_MAKE_MISSING", severity: "info", message: "Camera manufacturer information is missing." },
                    { code: "CAPTURE_TIME_UNAVAILABLE", severity: "info", message: "Original capture timestamp is unavailable." },
                    { code: "GPS_NOT_PRESENT", severity: "info", message: "No geographic coordinates found." },
                  ],
                },
              },
              compression: {
                status: "COMPLETED",
                result: {
                  format: "JPEG",
                  quantization_tables: { "0": [8, 6, 5], "1": [9, 10, 14] },
                  chroma_subsampling: "4:4:4",
                  findings: [
                    { code: "NON_STANDARD_SUBSAMPLING", severity: "warning", message: "Chroma subsampling differs from standard camera baseline (4:4:4 vs expected 4:2:0)." },
                  ],
                },
              },
              imageQuality: {
                status: "COMPLETED",
                result: {
                  resolution: { width: 2048, height: 2048, megapixels: 4.19 },
                  sharpness: { laplacian_variance: 12.5, assessment: "possibly_blurry" },
                  illumination: { mean_brightness: 142.8, assessment: "well_exposed" },
                  contrast: { std_dev: 38.1, assessment: "moderate_contrast" },
                  noise: { estimated: 1.2, assessment: "very_low_noise" },
                  findings: [
                    { code: "POSSIBLY_BLURRY", severity: "warning", message: "The image has a low Laplacian variance (12.5), indicating soft focus or unnatural smoothness." },
                  ],
                },
              },
              aiGeneration: {
                status: "COMPLETED",
                result: {
                  model: "abacusai/Smaug-AI-Image-Detector",
                  aiGeneratedScore: 0.92,
                  aiGeneratedPercentage: 92.0,
                  interpretation:
                    "Image shows a high probability of being AI-generated.",
                },
              },
            },
            review: {
              required: true,
              priority: "NORMAL",
              reasons: [
                "AI-generation screening score exceeded the configured review threshold.",
                "compression: Chroma subsampling differs from standard camera baseline (4:4:4 vs expected 4:2:0).",
                "imageQuality: The image has a low Laplacian variance (12.5), indicating soft focus or unnatural smoothness.",
              ],
              coverageWarnings: [],
              limitations: [
                "AI-generation screening may miss localized edits in otherwise genuine photographs.",
                "No flags detected does not establish image authenticity.",
              ],
            },
          },
        ],
      },
      evidence: {
        claimId: "CG-DEMO-002",
        overallStatus: "COMPLETED",
        overallVerdict: "UNCERTAIN",
        requiresReview: true,
        evidenceResults: [
          {
            key: "demo/ai-damage.jpg",
            fileName: "ai-damage.jpg",
            evidenceType: "image",
            contentType: "image/jpeg",
            status: "COMPLETED",
            verdict: "UNCERTAIN",
            detectedContent:
              "The image depicts a vehicle with damage to the right door and fender. However, the image exhibits characteristics typical of AI-generated imagery: unnaturally smooth surfaces, inconsistent reflections, and a lack of fine environmental detail.",
            relevanceExplanation:
              "While the depicted damage could correspond to a side collision, the forensics analysis and AI-generation screening suggest this may not be a genuine photograph. Manual verification by an adjuster is required before any decision.",
            reasons: [
              "Image appears synthetic — AI-generation screening returned a 92% probability score.",
              "No EXIF metadata or camera telemetry present.",
              "Unnaturally low noise and smooth surfaces inconsistent with real camera capture.",
            ],
            confidenceScore: 0.45,
          },
        ],
        disclaimer:
          "Evidence relevance screening is an automated heuristic and does not establish image or document authenticity or prove fraud.",
      },
    },
  },

  {
    id: "duplicate-violation",
    icon: "copy",
    name: "Duplicate & policy-violating",
    description: "Property claim with expired policy, duplicate ID, outlier amount, and mismatched evidence.",
    expectedOutcome: "Multiple flags",
    claimId: "CG-DEMO-003",
    claim: {
      claimType: "Property",
      policyNumber: "POL-PR-200001",
      incidentDate: "2026-01-15",
      claimAmountINR: 500000,
      location: "Delhi, NCR",
      description:
        "Water damage to interior walls and flooring from a burst pipe in the kitchen area.",
    },
    documents: [
      {
        name: "repair-estimate.pdf",
        size: 180000,
        type: "application/pdf",
        s3Key: "demo/repair-estimate.pdf",
        extractedData: {
          documentType: "repair_estimate",
          claimantName: "Priya Singh",
          policyNumber: "POL-PR-200001",
          claimNumber: "CG-DEMO-2026-0001",
          claimType: "Property",
          incidentDate: "2026-01-15",
          claimAmountINR: 500000,
          providerName: "Delhi Renovations Pvt Ltd",
          invoiceNumber: "INV-2026-7001",
          incidentLocation: "Sector 18, Delhi",
          incidentDescription: "Kitchen renovation and tile replacement",
          missingFields: [],
          uncertainFields: [],
          extractionNotes: [],
        },
      },
    ],
    checks: {
      policy: {
        policyNumber: "POL-PR-200001",
        validationStatus: "REVIEW",
        checks: {
          policyExists: true,
          policyStatus: "FLAG",
          coverageDates: "FLAG",
          claimType: "PASS",
          coverageLimit: "PASS",
        },
        flags: [
          {
            code: "POLICY_NOT_ACTIVE",
            message: "Recorded policy status is 'EXPIRED'.",
          },
          {
            code: "INCIDENT_OUTSIDE_COVERAGE",
            message: "The incident date is outside the recorded coverage period.",
          },
        ],
        note: "These are screening findings, not a determination of fraud or a final coverage decision.",
      },
      duplicate: {
        duplicateStatus: "REVIEW",
        matchType: "EXACT_CLAIM_ID",
        message: "Potential duplicate found; analyst review is recommended.",
        matches: [
          {
            claimId: "CG-DEMO-2026-0001",
            policyNumber: "POL-PR-200001",
            incidentDate: "2026-01-15",
            claimAmountINR: 500000,
            source: "REFERENCE",
          },
        ],
        imageMatches: [],
        imageMatchStatus: "NO_MATCH",
        registeredClaimId: "CG-DEMO-003",
        note: "A matching record is a review signal, not proof of fraud.",
      },
      outlier: {
        status: "REVIEW",
        claimType: "Property",
        claimAmountINR: 500000,
        sampleSize: 7,
        method: "ROBUST_Z_SCORE",
        threshold: 3.5,
        medianINR: 125000,
        madINR: 35000,
        q1INR: 92000,
        q3INR: 180000,
        lowerBoundINR: -20615.38,
        upperBoundINR: 270615.38,
        robustZScore: 4.22,
        message:
          "Claim amount is outside the statistical bounds for comparable reference claims.",
        disclaimer: "An outlier is a screening signal, not proof of fraud.",
      },
      forensics: {
        skipped: true,
        reason: "NO_IMAGES",
        claimId: "CG-DEMO-003",
        analysisStatus: "SKIPPED",
        imagesSubmitted: 0,
        analysesCompleted: 0,
        analysesWithErrors: 0,
        images: [],
        message:
          "No JPG, JPEG or PNG images were uploaded for this claim.",
      },
      evidence: {
        claimId: "CG-DEMO-003",
        overallStatus: "COMPLETED",
        overallVerdict: "POTENTIAL_MISMATCH",
        requiresReview: true,
        evidenceResults: [
          {
            key: "demo/repair-estimate.pdf",
            fileName: "repair-estimate.pdf",
            evidenceType: "document",
            contentType: "application/pdf",
            status: "COMPLETED",
            verdict: "POTENTIAL_MISMATCH",
            detectedContent:
              "The document is a repair estimate for 'kitchen renovation and tile replacement' totaling ₹5,00,000. The estimate describes full renovation work including new cabinetry, tiling, and painting — not emergency water damage repair.",
            relevanceExplanation:
              "The repair estimate describes renovation work rather than emergency water damage repair. The scope of work (full kitchen renovation) is inconsistent with the reported incident (burst pipe water damage). An adjuster should verify whether this claim is for renovation or genuine damage repair.",
            reasons: [
              "Document describes renovation work, not emergency water damage repair",
              "Scope of work (full kitchen renovation) exceeds typical burst-pipe damage",
              "Invoice total is significantly higher than typical water damage claims",
            ],
            confidenceScore: 0.87,
          },
        ],
        disclaimer:
          "Evidence relevance screening is an automated heuristic and does not establish image or document authenticity or prove fraud.",
      },
    },
  },
];
