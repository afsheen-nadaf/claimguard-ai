// Image forensics normalization and status helpers.
// Handles fields from the AWS Lambda image-forensics service (metadata, compression, and quality analyzers).
// Supports all backend states, including skipped analysis when no photos are present.

import { formatBytes } from "./format.js";

const EDITOR_KEYWORDS = [
  "snapseed",
  "photoshop",
  "lightroom",
  "gimp",
  "canva",
  "picsart",
  "remini",
  "facetune",
  "vsco",
  "polarr",
  "affinity",
  "pixlr",
];

export const FINDING_DESCRIPTIONS = {
  // Metadata findings
  EXIF_NOT_PRESENT:
    "No readable EXIF metadata was found. Many messaging apps, mobile browsers, and social platforms automatically strip EXIF metadata during upload to protect privacy.",
  CAMERA_MAKE_MISSING:
    "Camera manufacturer information is missing from the file header. Typical for screenshots, exported web graphics, or processed images.",
  CAPTURE_TIME_UNAVAILABLE:
    "Original capture timestamp is unavailable in the image header. File timestamps reflect system upload or transfer times.",
  SOFTWARE_EDIT_DETECTED:
    "Software metadata tag indicates image editing or export software (such as Snapseed or a photo editor). Always corroborate with incident context.",
  GPS_NOT_PRESENT:
    "No geographic coordinates found. Location tags are frequently disabled by mobile privacy settings or stripped upon upload.",

  // Compression findings
  JPEG_TABLES_UNAVAILABLE:
    "JPEG quantization tables are unavailable for this image. Expected for PNG files or non-JPEG bitstreams.",
  JPEG_COMPRESSION_DATA_EXTRACTED:
    "JPEG quantization tables were successfully extracted and parsed from the file stream.",
  QUANTIZATION_TABLES_MISSING:
    "Quantization tables could not be extracted from this image stream. Normal for non-JPEG formats or transcoded images.",
  NON_STANDARD_SUBSAMPLING:
    "Chroma subsampling differs from standard camera baseline. Mobile messaging apps often re-encode images to save bandwidth.",
  HIGH_COMPRESSION:
    "High quantization coefficients indicate aggressive JPEG compression, reducing high-frequency image detail.",

  // Image quality findings
  LOW_RESOLUTION:
    "Image dimensions are relatively small (under 640×480 px), which limits fine forensic inspection.",
  POSSIBLY_BLURRY:
    "The image has a low Laplacian variance (<50), indicating soft focus or motion blur.",
  LOW_BRIGHTNESS:
    "The image has low mean luminance (<40), indicating underexposure or low-light capture.",
  HIGH_BRIGHTNESS:
    "The image has elevated mean luminance (>215), indicating overexposure or specular glare.",
  LOW_CONTRAST:
    "The image has relatively low luminance contrast (<25 std dev), indicating flat lighting or haze.",
};

export function extractForensicsOverview(record) {
  const documents = record?.documents || [];
  const imageDocs = documents.filter((d) => {
    const isImgType = ["image/jpeg", "image/png"].includes(d.type);
    const isImgExt = /\.(jpe?g|png)$/i.test(d.name || "");
    return isImgType || isImgExt;
  });

  const forensicsCheck = record?.checks?.forensics;
  const rawForensics =
    forensicsCheck?.raw ||
    record?.checks?.duplicate?.raw?.imageForensics ||
    record?.forensics ||
    null;

  const imagesSubmitted = rawForensics?.imagesSubmitted ?? imageDocs.length;
  const imagesList = Array.isArray(rawForensics?.images) ? rawForensics.images : [];
  const imagesAnalyzed = imagesList.length;

  const flaggedImages = imagesList.filter((img) => img.review?.required === true);
  const hasReviewRequired = flaggedImages.length > 0;

  let analysisState = "idle";
  let analysisStateLabel = "Not started";

  if (forensicsCheck?.status === "running") {
    analysisState = "running";
    analysisStateLabel = "Analyzing…";
  } else if (forensicsCheck?.status === "error") {
    analysisState = "error";
    analysisStateLabel = "Failed";
  } else if (rawForensics?.skipped || imagesSubmitted === 0) {
    analysisState = "skipped";
    analysisStateLabel = "Skipped (No images)";
  } else if (rawForensics?.analysisStatus === "COMPLETED") {
    analysisState = hasReviewRequired ? "review" : "pass";
    analysisStateLabel = hasReviewRequired ? "Review recommended" : "Completed";
  } else if (rawForensics?.analysisStatus === "PARTIAL") {
    analysisState = "review";
    analysisStateLabel = "Partially completed";
  } else if (rawForensics?.analysisStatus === "FAILED") {
    analysisState = "error";
    analysisStateLabel = "Failed";
  } else if (rawForensics) {
    analysisState = hasReviewRequired ? "review" : "pass";
    analysisStateLabel = hasReviewRequired ? "Review recommended" : "Completed";
  }

  const getModuleStatus = (key) => {
    if (analysisState === "running") return "Analyzing…";
    if (analysisState === "error" && !imagesList.length) return "Failed";
    if (rawForensics?.skipped || imagesSubmitted === 0) return "Not applicable";
    if (!rawForensics || !imagesList.length) return "Not available";

    const statuses = imagesList.map((img) => img.analyses?.[key]?.status);
    if (statuses.every((s) => s === "COMPLETED")) return "Completed";
    if (statuses.some((s) => s === "COMPLETED")) return "Partially completed";
    if (statuses.some((s) => s === "ERROR")) return "Error";
    return "Not available";
  };

  const aiGenerationStatus = getModuleStatus("aiGeneration");
  const metadataStatus = getModuleStatus("metadata");
  const compressionStatus = getModuleStatus("compression");
  const qualityStatus = getModuleStatus("imageQuality");

  const duplicateCheck = record?.checks?.duplicate;
  let duplicateStatus = "Pending";
  if (duplicateCheck?.status === "running") duplicateStatus = "Running";
  else if (duplicateCheck?.status === "error") duplicateStatus = "Check failed";
  else if (duplicateCheck?.status === "done") {
    const imgMatches = duplicateCheck.result?.imageMatches || [];
    if (imgMatches.length > 0) {
      duplicateStatus = `Review required (${imgMatches.length} visual match${
        imgMatches.length === 1 ? "" : "es"
      })`;
    } else if (imagesSubmitted === 0) {
      duplicateStatus = "No images submitted";
    } else {
      duplicateStatus = "No visual duplicates found";
    }
  }

  return {
    imagesSubmitted,
    imagesAnalyzed,
    analysisState,
    analysisStateLabel,
    aiGenerationStatus,
    metadataStatus,
    compressionStatus,
    qualityStatus,
    duplicateStatus,
    hasReviewRequired,
    flaggedImagesCount: flaggedImages.length,
    hasRawData: Boolean(rawForensics && !rawForensics.skipped && imagesList.length > 0),
    isSkipped: Boolean(rawForensics?.skipped || imagesSubmitted === 0),
    rawForensics,
    imagesList,
    imageDocs,
    analysesCompleted: rawForensics?.analysesCompleted ?? 0,
    analysesWithErrors: rawForensics?.analysesWithErrors ?? 0,
    disclaimer:
      rawForensics?.disclaimer ||
      "Metadata, compression, image-quality and AI-generation observations are screening indicators only. They do not establish image manipulation or fraud. Smaug may miss localized AI edits in otherwise genuine photographs. All flagged claims require human review.",
  };
}

function detectEditorFromSoftware(software) {
  if (!software) return null;
  const lower = String(software).toLowerCase();
  const match = EDITOR_KEYWORDS.find((kw) => new RegExp(`\\b${kw}\\b`, "i").test(lower));
  return match ? match.charAt(0).toUpperCase() + match.slice(1) : null;
}

export function normalizeMetadata(rawInput, doc, incidentDate = null) {
  if (!rawInput && !doc) return null;

  const raw = rawInput?.result || rawInput || {};
  const status =
    rawInput?.status || (raw.file_name || raw.sha256 ? "COMPLETED" : "UNAVAILABLE");
  const error = rawInput?.error || null;

  const fileName = raw.file_name || raw.fileName || doc?.name || "Uploaded image";
  const fileSizeBytes = raw.file_size_bytes ?? raw.fileSizeBytes ?? doc?.size ?? null;
  const fileSize = fileSizeBytes != null ? formatBytes(fileSizeBytes) : "—";
  const fileExtension =
    raw.file_extension ||
    raw.fileExtension ||
    (doc?.name ? `.${doc.name.split(".").pop().toLowerCase()}` : "—");

  const sha256 = raw.sha256 || raw.sha256Hash || null;
  const props = raw.image_properties || {};
  const imageFormat = props.format || raw.imageFormat || raw.format || "—";
  const width = props.width ?? raw.width ?? null;
  const height = props.height ?? raw.height ?? null;
  const megapixels =
    props.megapixels != null
      ? `${Number(props.megapixels).toFixed(2)} MP`
      : width && height
      ? `${((width * height) / 1_000_000).toFixed(2)} MP`
      : "—";

  const pillowExif = raw.pillow_exif_metadata || raw.exif || {};
  const indicators = raw.metadata_indicators || {};
  const exifPresent = indicators.exif_present ?? Object.keys(pillowExif).length > 0;

  const cameraMake = pillowExif.Make || raw.cameraMake || null;
  const cameraModel = pillowExif.Model || raw.cameraModel || null;
  const captureTimestamp =
    pillowExif.DateTimeOriginal || pillowExif.DateTime || raw.captureTimestamp || null;
  const software = pillowExif.Software || raw.software || null;

  const matchedEditor =
    raw.matched_editor || detectEditorFromSoftware(software) || null;
  const editingSoftwareDetected = Boolean(
    raw.editing_software_detected ??
      indicators.editing_software_detected ??
      matchedEditor
  );

  const orientationLabel =
    props.orientation_label ||
    (pillowExif.Orientation ? `EXIF Orientation ${pillowExif.Orientation}` : null);

  const hasGps = indicators.gps_metadata_present ?? Boolean(raw.gps_metadata_present || raw.hasGps);
  const gpsCoordinates =
    raw.gps_coordinates_formatted ||
    (raw.gps_latitude != null && raw.gps_longitude != null
      ? `${raw.gps_latitude}, ${raw.gps_longitude}`
      : null);

  let timestampNote = null;
  if (captureTimestamp && incidentDate) {
    const capDateStr = String(captureTimestamp).slice(0, 10).replace(/:/g, "-");
    const incDateStr = String(incidentDate).slice(0, 10);
    if (capDateStr && incDateStr && /^\d{4}-\d{2}-\d{2}$/.test(capDateStr)) {
      if (capDateStr > incDateStr) {
        timestampNote = `Capture date (${capDateStr}) is after reported incident date (${incDateStr}).`;
      } else if (capDateStr === incDateStr) {
        timestampNote = `Capture date matches reported incident date (${incDateStr}).`;
      } else {
        timestampNote = `Capture date (${capDateStr}) is earlier than reported incident date (${incDateStr}).`;
      }
    }
  }

  const rawFindings = Array.isArray(raw.findings)
    ? raw.findings
    : Array.isArray(raw.warnings)
    ? raw.warnings
    : [];

  const findings = rawFindings.map((f) => {
    if (typeof f === "string") {
      return {
        code: f,
        severity: "informational",
        message: FINDING_DESCRIPTIONS[f] || f,
      };
    }
    return {
      code: f.code || "METADATA_FINDING",
      severity: f.severity || "informational",
      message: f.message || FINDING_DESCRIPTIONS[f.code] || f.code,
    };
  });

  if (editingSoftwareDetected && !findings.some((f) => f.code === "SOFTWARE_EDIT_DETECTED")) {
    findings.push({
      code: "SOFTWARE_EDIT_DETECTED",
      severity: "informational",
      message: matchedEditor
        ? `Editing/export tool "${matchedEditor}" detected in Software tag (${software}).`
        : FINDING_DESCRIPTIONS.SOFTWARE_EDIT_DETECTED,
    });
  }

  return {
    status,
    error,
    fileName,
    fileSize,
    fileExtension,
    sha256,
    imageFormat,
    width,
    height,
    megapixels,
    orientationLabel,
    exifPresent,
    exifAvailability: exifPresent ? "Detected" : "Not detected",
    cameraMake: cameraMake || "Not available",
    cameraModel: cameraModel || "Not available",
    captureTimestamp: captureTimestamp || "Not available",
    timestampNote,
    software: software || "Not detected",
    editingSoftwareDetected,
    matchedEditor,
    hasGps,
    gpsCoordinates,
    gpsAvailability: hasGps ? "Present" : "Not detected",
    exifMetadata: pillowExif,
    findings,
    warnings: findings.map((f) => f.code),
  };
}

export function normalizeCompression(rawInput, doc) {
  if (!rawInput && !doc) return null;

  const raw = rawInput?.result || rawInput || {};
  const status =
    rawInput?.status || (raw.image_format || raw.imageFormat ? "COMPLETED" : "UNAVAILABLE");
  const error = rawInput?.error || null;

  const imageFormat = (raw.image_format || raw.imageFormat || "JPEG").toUpperCase();
  const isPng = imageFormat === "PNG" || /\.png$/i.test(raw.file_name || doc?.name || "");

  const compAnalysis = raw.compression_analysis || {};
  const quantizationTableCount =
    compAnalysis.quantization_table_count ?? raw.quantizationTableCount ?? null;
  const quantizationTables = compAnalysis.quantization_tables || null;

  let coefficientCount =
    raw.quantizationTableCoefficients ?? raw.quantizationTableCoefficientCount ?? null;
  let minCoefficient = raw.minCoefficient ?? null;
  let maxCoefficient = raw.maxCoefficient ?? null;
  let meanCoefficient =
    raw.meanCoefficient != null
      ? typeof raw.meanCoefficient === "number"
        ? raw.meanCoefficient.toFixed(2)
        : String(raw.meanCoefficient)
      : null;

  if (quantizationTables && typeof quantizationTables === "object") {
    const tableList = Object.values(quantizationTables);
    if (tableList.length > 0) {
      coefficientCount = tableList[0].coefficient_count || 64;
      const mins = tableList.map((t) => t.minimum).filter((v) => v != null);
      const maxs = tableList.map((t) => t.maximum).filter((v) => v != null);
      const means = tableList.map((t) => t.mean).filter((v) => v != null);
      if (mins.length) minCoefficient = Math.min(...mins);
      if (maxs.length) maxCoefficient = Math.max(...maxs);
      if (means.length)
        meanCoefficient = (means.reduce((a, b) => a + b, 0) / means.length).toFixed(2);
    }
  }

  const encodingProcess =
    raw.encoding_process ||
    raw.encodingProcess ||
    (isPng ? "Deflate / zlib compression" : null);
  const ycbcrSubsampling = raw.ycbcr_subsampling || raw.ycbcrSubsampling || null;
  const bitsPerSample = raw.bits_per_sample ?? raw.bitsPerSample ?? null;
  const fileType = raw.file_type || raw.fileType || imageFormat;

  const reencodingCue = isPng
    ? "Lossless PNG container (DEFLATE); check whether screenshot/export vs. original camera capture."
    : !quantizationTableCount
    ? "No JPEG quantization tables in bitstream; common after re-encoding or progressive/web export."
    : ycbcrSubsampling && !String(ycbcrSubsampling).includes("4:2:0")
    ? `Chroma subsampling (${ycbcrSubsampling}) differs from typical mobile 4:2:0 capture.`
    : "Standard JPEG quantization & chroma layout observed.";

  const rawFindings = Array.isArray(raw.findings)
    ? raw.findings
    : Array.isArray(raw.warnings)
    ? raw.warnings
    : [];

  const findings = rawFindings.map((f) => {
    if (typeof f === "string") {
      return {
        code: f,
        severity: "informational",
        message: FINDING_DESCRIPTIONS[f] || f,
      };
    }
    return {
      code: f.code || "COMPRESSION_FINDING",
      severity: f.severity || "informational",
      message: f.message || FINDING_DESCRIPTIONS[f.code] || f.code,
    };
  });

  return {
    status,
    error,
    imageFormat,
    isPng,
    hasQuantizationTables: Boolean(quantizationTableCount && quantizationTableCount > 0),
    quantizationTableCount,
    quantizationTables,
    coefficientCount,
    minCoefficient,
    maxCoefficient,
    meanCoefficient,
    encodingProcess,
    ycbcrSubsampling,
    bitsPerSample,
    fileType,
    reencodingCue,
    findings,
    warnings: findings.map((f) => f.code),
  };
}

export function normalizeQuality(rawInput, doc) {
  if (!rawInput && !doc) return null;

  const raw = rawInput?.result || rawInput || {};
  const status =
    rawInput?.status ||
    (raw.image_quality || raw.blurScore != null ? "COMPLETED" : "UNAVAILABLE");
  const error = rawInput?.error || null;

  const imgQuality = raw.image_quality || {};
  const width = imgQuality.width ?? raw.width ?? null;
  const height = imgQuality.height ?? raw.height ?? null;

  const dimensions =
    width && height
      ? `${width} × ${height}`
      : raw.dimensions
      ? String(raw.dimensions)
      : "—";

  const megapixels =
    imgQuality.megapixels != null
      ? `${Number(imgQuality.megapixels).toFixed(2)} MP`
      : raw.megapixels != null
      ? `${Number(raw.megapixels).toFixed(2)} MP`
      : width && height
      ? `${((width * height) / 1_000_000).toFixed(2)} MP`
      : "—";

  const blurScore = imgQuality.blur_score ?? raw.blurScore ?? null;
  const brightnessScore = imgQuality.brightness_score ?? raw.brightnessScore ?? null;
  const contrastScore = imgQuality.contrast_score ?? raw.contrastScore ?? null;
  const noiseEstimate = imgQuality.noise_estimate ?? raw.noiseEstimate ?? null;

  const rawFindings = Array.isArray(raw.findings)
    ? raw.findings
    : Array.isArray(raw.warnings)
    ? raw.warnings
    : [];

  const findings = rawFindings.map((f) => {
    if (typeof f === "string") {
      return {
        code: f,
        severity: "informational",
        message: FINDING_DESCRIPTIONS[f] || f,
      };
    }
    return {
      code: f.code || "QUALITY_OBSERVATION",
      severity: f.severity || "informational",
      message: f.message || FINDING_DESCRIPTIONS[f.code] || f.code,
    };
  });

  return {
    status,
    error,
    dimensions,
    megapixels,
    blurScore: blurScore != null ? Number(blurScore) : null,
    brightnessScore: brightnessScore != null ? Number(brightnessScore) : null,
    contrastScore: contrastScore != null ? Number(contrastScore) : null,
    noiseEstimate: noiseEstimate != null ? Number(noiseEstimate) : null,
    findings,
    warnings: findings.map((f) => f.code),
  };
}

export function normalizeAiGeneration(rawInput, doc) {
  if (!rawInput && !doc) return null;

  const raw = rawInput?.result || rawInput || {};
  const status =
    rawInput?.status ||
    (raw.aiGeneratedScore != null || raw.aiGeneratedPercentage != null
      ? "COMPLETED"
      : "UNAVAILABLE");
  const error = rawInput?.error || null;
  const isCompleted = status === "COMPLETED" && raw.aiGeneratedScore != null;

  const model = raw.model || "abacusai/Smaug-AI-Image-Detector";
  const score =
    isCompleted &&
    typeof raw.aiGeneratedScore === "number" &&
    Number.isFinite(raw.aiGeneratedScore)
      ? raw.aiGeneratedScore
      : null;

  const percentage =
    isCompleted && raw.aiGeneratedPercentage != null
      ? Number(raw.aiGeneratedPercentage)
      : score != null
      ? Number((score * 100).toFixed(2))
      : null;

  const interpretation =
    raw.interpretation ||
    (score != null
      ? score >= 0.5
        ? "Higher AI-generation score"
        : "Lower AI-generation score"
      : "Not available");

  const disclaimer =
    raw.disclaimer ||
    "This is an AI-generation screening score, not proof of image authenticity, manipulation, or fraud. Localized AI edits in otherwise genuine photographs may not be detected.";

  return {
    status,
    error,
    isCompleted,
    model,
    score,
    percentage,
    interpretation,
    disclaimer,
  };
}

export function normalizeReview(rawReview) {
  if (!rawReview) {
    return {
      required: false,
      priority: "NONE",
      reasons: [],
      coverageWarnings: [],
      limitations: [
        "AI-generation screening may miss localized edits in otherwise genuine photographs.",
        "No flags detected does not establish image authenticity.",
      ],
    };
  }

  return {
    required: Boolean(rawReview.required),
    priority: rawReview.priority || (rawReview.required ? "NORMAL" : "NONE"),
    reasons: Array.isArray(rawReview.reasons) ? rawReview.reasons : [],
    coverageWarnings: Array.isArray(rawReview.coverageWarnings)
      ? rawReview.coverageWarnings
      : [],
    limitations:
      Array.isArray(rawReview.limitations) && rawReview.limitations.length > 0
        ? rawReview.limitations
        : [
            "AI-generation screening may miss localized edits in otherwise genuine photographs.",
            "No flags detected does not establish image authenticity.",
          ],
  };
}

export function buildForensicTakeaways({ overview, aiGeneration, metadata, compression, quality, review }) {
  if (overview?.isSkipped) {
    return [
      "Image forensics was skipped because no JPG, JPEG, or PNG photos were attached to the claim.",
    ];
  }

  const bullets = [];
  if (aiGeneration?.isCompleted && aiGeneration.percentage != null) {
    bullets.push(
      `Smaug AI score: ${aiGeneration.percentage}% (${aiGeneration.interpretation.toLowerCase()}).`
    );
  }
  if (metadata) {
    const gpsPart = metadata.gpsCoordinates
      ? `GPS: ${metadata.gpsCoordinates}`
      : `GPS: ${metadata.gpsAvailability}`;
    const editPart = metadata.editingSoftwareDetected
      ? `Editor tag: ${metadata.matchedEditor || metadata.software}`
      : "No editor tag detected";
    bullets.push(`Metadata: ${gpsPart} • ${editPart}.`);
  }
  if (compression?.imageFormat) {
    bullets.push(`Compression: ${compression.reencodingCue}`);
  }
  if (review?.required) {
    bullets.push(`Action: Human review recommended (${review.reasons.length} flag${review.reasons.length === 1 ? "" : "s"}).`);
  } else if (quality?.status === "COMPLETED") {
    bullets.push("Action: No automated threshold flags triggered; verify with incident records.");
  }
  return bullets.slice(0, 4);
}