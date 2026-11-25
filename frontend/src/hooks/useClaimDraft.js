import { useCallback, useRef, useState } from "react";
import { CLAIM_TYPES, UPLOAD_RULES } from "../api/config";
import { extractDocument, uploadDocument } from "../api/claims";
import {
  EMPTY_FORM,
  newClaimId,
  toClaimSnapshot,
  validateClaim,
} from "../lib/validation";
import { formatBytes } from "../lib/format";

let fileCounter = 0;

function withWorkflowStep(current, step) {
  return typeof current === "number"
    ? { step, entryMode: null }
    : { ...current, step };
}

// Maps Bedrock extraction output fields to the claim-form field names.
// Only these fields are auto-filled from uploaded documents.
const EXTRACTION_FIELD_MAP = {
  claimantName: "claimantName",
  policyNumber: "policyNumber",
  claimType: "claimType",
  incidentDate: "incidentDate",
  claimAmountINR: "amount",
  incidentLocation: "location",
  incidentDescription: "description",
};

// Synonyms: documents may use different terms for the same claim type.
// In India, "motor" insurance = "auto" insurance. Keys are lowercased.
const CLAIM_TYPE_SYNONYMS = {
  motor: "Auto",
  vehicle: "Auto",
  car: "Auto",
  two_wheeler: "Auto",
  bike: "Auto",
  house: "Property",
  home: "Property",
  fire: "Property",
  medical: "Health",
  mediclaim: "Health",
  hospital: "Health",
  trip: "Travel",
  flight: "Travel",
  abroad: "Travel",
};

// Match an extracted claim-type string against the canonical CLAIM_TYPES.
// The model may return "auto", "Auto", "motor insurance", etc.
function normalizeClaimType(value) {
  if (!value || typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();

  // First try a direct match against canonical types.
  const direct = CLAIM_TYPES.find(
    (t) => t.toLowerCase() === lower || lower.includes(t.toLowerCase())
  );
  if (direct) return direct;

  // Then check the synonym table — look for any synonym key that appears
  // as a substring in the extracted value (e.g. "motor insurance" → "motor").
  for (const [synonym, canonical] of Object.entries(CLAIM_TYPE_SYNONYMS)) {
    if (lower.includes(synonym)) {
      return canonical;
    }
  }

  return null;
}

// Given an extractedData object from the extraction endpoint, return a
// partial form patch containing only fields that are currently empty and
// for which the extracted value is non-null and valid. Returns:
// - patch: the field values to merge into the form
// - filledFields: field names that were filled (were empty, now have values)
// - skippedFields: field names that were present in the extracted data but
//   skipped because the form field was already filled (by the user or by
//   an earlier document's extraction). This lets the UI distinguish "the
//   document had no extractable fields" from "fields were already filled."
function buildExtractionPatch(extractedData, currentForm) {
  if (!extractedData || typeof extractedData !== "object") {
    return { patch: {}, filledFields: [], skippedFields: [] };
  }

  const patch = {};
  const filledFields = [];
  const skippedFields = [];

  for (const [extractKey, formKey] of Object.entries(EXTRACTION_FIELD_MAP)) {
    const rawValue = extractedData[extractKey];
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;

    // Never overwrite a field the user has already filled.
    if (currentForm[formKey] && String(currentForm[formKey]).trim() !== "") {
      skippedFields.push(formKey);
      continue;
    }

    if (extractKey === "claimType") {
      const normalized = normalizeClaimType(rawValue);
      if (normalized) {
        patch[formKey] = normalized;
        filledFields.push(formKey);
      }
    } else if (extractKey === "claimAmountINR") {
      const n = Number(rawValue);
      if (Number.isFinite(n) && n > 0) {
        patch[formKey] = String(n);
        filledFields.push(formKey);
      }
    } else if (extractKey === "incidentDate") {
      const dateStr = String(rawValue).trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        patch[formKey] = dateStr;
        filledFields.push(formKey);
      }
    } else {
      const strValue = String(rawValue).trim();
      if (strValue) {
        patch[formKey] = strValue;
        filledFields.push(formKey);
      }
    }
  }

  return { patch, filledFields, skippedFields };
}

// Holds the in-progress claim so the user can move between steps
// without losing what they typed or selected.
export function useClaimDraft() {
  const [workflow, setWorkflow] = useState(1);
  const step = typeof workflow === "number" ? workflow : workflow.step;
  const entryMode = typeof workflow === "number" ? null : workflow.entryMode;
  const setStep = (nextStep) => setWorkflow((current) => withWorkflowStep(current, nextStep));
  const setEntryMode = (nextEntryMode) => {
    setWorkflow((current) => typeof current === "number"
      ? { step: 1, entryMode: nextEntryMode }
      : { ...current, step: 1, entryMode: nextEntryMode });
  };
  const [form, setForm] = useState({ ...EMPTY_FORM, claimantName: "" });
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);

  // Each file can now also contain:
  // s3Key, contentType, extractionStatus, extractionError, extractedData,
  // extractedFields (the form fields filled from this document)
  const [files, setFiles] = useState([]);

  const [fileMessages, setFileMessages] = useState([]);
  const [submitError, setSubmitError] = useState("");

  // Tracks which form fields were pre-filled from document extraction,
  // and which file contributed them. Shape: { [formField]: fileName }
  const [prefilledFields, setPrefilledFields] = useState({});

  const claimIdRef = useRef(null);

  // Lazily generate the claim ID so it exists before the first upload
  // (the upload places files under incoming/{claimId}/, which the
  // evidence-relevance endpoint requires).
  const ensureClaimId = useCallback(() => {
    if (!claimIdRef.current) {
      claimIdRef.current = newClaimId();
    }
    return claimIdRef.current;
  }, []);

  const setField = useCallback(
    (key, value) => {
      setForm((cur) => ({
        ...cur,
        [key]: value,
      }));
    },
    []
  );

  const touch = useCallback(
    (key) => {
      setTouched((cur) => ({
        ...cur,
        [key]: true,
      }));
    },
    []
  );

  // Update one file entry in state by id. Defined before uploadAndExtract
  // and addFiles so they can reference it without a forward declaration.
  const patchFile = useCallback((id, patch) => {
    setFiles((cur) =>
      cur.map((file) =>
        file.id === id
          ? { ...file, ...patch }
          : file
      )
    );
  }, []);

  // Upload evidence files and extract fields from PDF documents only.
  const uploadAndExtract = useCallback(
    async (entry, claimId) => {
      // 1. Upload to S3 via presigned URL.
      try {
        const uploaded = await uploadDocument(
          entry.file,
          (progress) => patchFile(entry.id, { progress }),
          claimId
        );

        patchFile(entry.id, {
          status: "done",
          progress: 1,
          s3Key: uploaded.key,
          contentType: uploaded.contentType,
        });

        if (entry.category === "image") {
          patchFile(entry.id, { extractionStatus: "not_applicable" });
          return;
        }

        // 2. Auto-extract fields via Bedrock (non-blocking on submit).
        patchFile(entry.id, { extractionStatus: "extracting" });

        try {
          const result = await extractDocument(
            uploaded.key,
            uploaded.contentType
          );

          const extractedData =
            result && result.extractedData ? result.extractedData : null;

          // 3. Merge extracted fields into the form (only empty fields).
          if (extractedData) {
            setForm((cur) => {
              const { patch, filledFields, skippedFields } = buildExtractionPatch(
                extractedData,
                cur
              );

              if (filledFields.length > 0) {
                // Record which file contributed which fields.
                setPrefilledFields((prev) => {
                  const next = { ...prev };
                  for (const field of filledFields) {
                    if (!next[field]) {
                      next[field] = entry.file.name;
                    }
                  }
                  return next;
                });
              }

              patchFile(entry.id, {
                extractionStatus: "extracted",
                extractedData,
                extractedFields: filledFields,
                skippedFields,
              });

              return { ...cur, ...patch };
            });
          } else {
            patchFile(entry.id, {
              extractionStatus: "extracted",
              extractedData: null,
              extractedFields: [],
              skippedFields: [],
            });
          }
        } catch (extractError) {
          // Extraction failed — the file is still uploaded and usable.
          patchFile(entry.id, {
            extractionStatus: "failed",
            extractionError:
              extractError.message ||
              "Field extraction could not be completed.",
          });
        }
      } catch (uploadError) {
        patchFile(entry.id, {
          status: "error",
          error: uploadError.message || "Upload failed.",
        });
      }
    },
    [patchFile]
  );

  const addFiles = useCallback(
    (fileList, category = "document") => {
      const incoming = Array.from(fileList || []);
      const accepted = [];
      const messages = [];
      const isImageCategory = category === "image";

      const isImageFile = (file) => {
        const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
        return (
          ["image/jpeg", "image/png"].includes(file.type) ||
          [".jpg", ".jpeg", ".png"].includes(ext)
        );
      };

      const existingImageCount = files.filter(
        (entry) => entry.category === "image"
      ).length;

      let acceptedImageCount = 0;

      for (const file of incoming) {
        const ext =
          "." + (file.name.split(".").pop() || "").toLowerCase();

        const isImage = isImageFile(file);
        const typeOk = isImageCategory
          ? isImage
          : file.type === "application/pdf" || ext === ".pdf";
        const allowedTypes = isImageCategory
          ? "JPG, JPEG or PNG images"
          : "PDF documents";

        const same = (entry) =>
          entry.file.name === file.name &&
          entry.file.size === file.size &&
          entry.file.lastModified === file.lastModified;

        if (!typeOk) {
          messages.push({
            tone: "error",
            category,
            text: `${file.name}: select ${allowedTypes}.`,
          });
        } else if (file.size === 0) {
          messages.push({
            tone: "error",
            category,
            text: `${file.name}: the file is empty.`,
          });
        } else if (file.size > UPLOAD_RULES.maxBytes) {
          messages.push({
            tone: "error",
            category,
            text: `${file.name} (${formatBytes(file.size)}): exceeds the 10 MB limit.`,
          });
        } else if (files.some(same) || accepted.some(same)) {
          messages.push({
            tone: "error",
            category,
            text: `${file.name}: already added.`,
          });
        } else if (
          isImageCategory &&
          existingImageCount + acceptedImageCount >= UPLOAD_RULES.maxImages
        ) {
          messages.push({
            tone: "error",
            category,
            text: `${file.name}: a maximum of ${UPLOAD_RULES.maxImages} images is allowed per claim.`,
          });
        } else {
          accepted.push({
            id: `f${++fileCounter}`,
            file,
            category,
            status: "uploading",
            progress: 0,
            error: null,
            s3Key: null,
            contentType: null,
            extractionStatus: isImageCategory ? "not_applicable" : "pending",
            extractionError: null,
            extractedData: null,
            extractedFields: [],
            skippedFields: [],
          });

          if (isImageCategory) {
            acceptedImageCount++;
          }
        }
      }

      if (accepted.length) {
        setFiles((cur) => [...cur, ...accepted]);

        // Kick off uploads immediately for each accepted file.
        // The claim ID is generated here so files land under
        // incoming/{claimId}/, which evidence-relevance requires.
        const claimId = ensureClaimId();

        for (const entry of accepted) {
          uploadAndExtract(entry, claimId);
        }
      }

      setFileMessages((currentMessages) => [
        ...currentMessages.filter((message) => message.category !== category),
        ...messages,
      ]);
    },
    [files, ensureClaimId, uploadAndExtract]
  );

  const removeFile = useCallback((id) => {
    setFiles((cur) => {
      const removed = cur.find((file) => file.id === id);
      if (removed) {
        const removedName = removed.file.name;
        // Clean up prefilledFields entries that referenced this file.
        // Only remove the tracking entry — the form field value itself
        // stays, since the user may have already edited it.
        setPrefilledFields((prev) => {
          const next = {};
          for (const [field, fileName] of Object.entries(prev)) {
            if (fileName !== removedName) {
              next[field] = fileName;
            }
          }
          return next;
        });
      }
      return cur.filter((file) => file.id !== id);
    });
    setFileMessages([]);
  }, []);

  const reset = useCallback(() => {
    setWorkflow(1);
    setForm({ ...EMPTY_FORM, claimantName: "" });
    setTouched({});
    setAttempted(false);
    setFiles([]);
    setFileMessages([]);
    setSubmitError("");
    setPrefilledFields({});
    claimIdRef.current = null;
  }, []);

  const trimmedName = String(form.claimantName || "").trim();
  const claimantNameError = !trimmedName
    ? "Enter the claimant's full name."
    : !/^[\p{L}\s]+$/u.test(trimmedName)
      ? "Name can only contain letters and spaces (no numbers or symbols)."
      : null;

  const errors = {
    ...validateClaim(form),
    ...(claimantNameError ? { claimantName: claimantNameError } : {}),
  };

  // Files now upload immediately when added in the Documents step, so
  // submit only needs to verify all uploads finished and pass the S3
  // keys + claim snapshot to the screening runner. This guards against
  // three blocking conditions: invalid form, no files, or files that
  // are still uploading or failed to upload.
  const submit = useCallback(
    (onReady) => {
      if (
        claimantNameError ||
        Object.keys(validateClaim(form)).length > 0
      ) {
        setAttempted(true);
        setWorkflow((current) => withWorkflowStep(current, 1));
        return;
      }

      if (files.length === 0) {
        setWorkflow((current) => withWorkflowStep(current, 2));
        return;
      }

      const failedFiles = files.filter((f) => f.status === "error");
      if (failedFiles.length > 0) {
        setSubmitError(
          `${failedFiles.length} supporting file${failedFiles.length === 1 ? "" : "s"} failed to upload, so no screening was run. Remove and re-add the failed file${failedFiles.length === 1 ? "" : "s"} to retry.`
        );
        return;
      }

      // Defensive guard: if any file is still uploading, its s3Key is null,
      // which would silently break the screening checks. Block submit and
      // tell the user to wait.
      const stillUploading = files.filter((f) => f.status !== "done");
      if (stillUploading.length > 0) {
        setSubmitError(
          `${stillUploading.length} file${stillUploading.length === 1 ? "" : "s"} are still uploading. Please wait for uploads to finish before screening.`
        );
        return;
      }

      // Extra guard: every file must have a non-null s3Key before screening.
      const missingKeys = files.filter((f) => !f.s3Key);
      if (missingKeys.length > 0) {
        setSubmitError(
          "One or more uploaded files are missing their storage key. Remove and re-add the affected files."
        );
        return;
      }

      const claimId = ensureClaimId();

      // Pass the S3 object keys and content types to the screening runner.
      // Include extractedData so consistency checks can compare document fields
      // without calling the extraction backend again.
      onReady({
        claimId,
        claim: {
          ...toClaimSnapshot(form),
          claimantName: String(form.claimantName || "").trim(),
        },
        documents: files.map((file) => ({
          name: file.file.name,
          size: file.file.size,
          type: file.contentType || file.file.type,
          s3Key: file.s3Key,
          extractedData: file.extractedData,
        })),
      });

      reset();
    },
    [files, form, reset, ensureClaimId]
  );

  return {
    step,
    setStep,
    entryMode,
    setEntryMode,
    form,
    setField,
    touched,
    touch,
    attempted,
    setAttempted,
    errors,

    files,
    fileMessages,
    addFiles,
    removeFile,

    prefilledFields,
    submitError,
    submit,
    reset,
  };
}