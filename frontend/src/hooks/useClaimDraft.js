
import { useCallback, useRef, useState } from "react";
import { UPLOAD_RULES } from "../api/config";
import { uploadDocument } from "../api/claims";
import {
  EMPTY_FORM,
  newClaimId,
  toClaimSnapshot,
  validateClaim,
} from "../lib/validation";
import { formatBytes } from "../lib/format";

let fileCounter = 0;

// Holds the in-progress claim so the user can move between steps
// without losing what they typed or selected.
export function useClaimDraft() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);

  // Each file can now also contain:
  // s3Key, contentType
  const [files, setFiles] = useState([]);

  const [fileMessages, setFileMessages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const submittingRef = useRef(false);
  const claimIdRef = useRef(null);

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

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList || []);
      const accepted = [];
      const messages = [];

      for (const file of incoming) {
        const ext =
          "." + (file.name.split(".").pop() || "").toLowerCase();

        const typeOk =
          UPLOAD_RULES.allowedTypes.includes(file.type) ||
          UPLOAD_RULES.allowedExtensions.includes(ext);

        const same = (entry) =>
          entry.file.name === file.name &&
          entry.file.size === file.size &&
          entry.file.lastModified === file.lastModified;

        if (!typeOk) {
          messages.push({
            tone: "error",
            text: `${file.name}: only PDF, JPG, JPEG or PNG files are accepted.`,
          });
        } else if (file.size === 0) {
          messages.push({
            tone: "error",
            text: `${file.name}: the file is empty.`,
          });
        } else if (file.size > UPLOAD_RULES.maxBytes) {
          messages.push({
            tone: "error",
            text: `${file.name} (${formatBytes(file.size)}): exceeds the 10 MB limit.`,
          });
        } else if (files.some(same) || accepted.some(same)) {
          messages.push({
            tone: "error",
            text: `${file.name}: already added.`,
          });
        } else {
          accepted.push({
            id: `f${++fileCounter}`,
            file,
            status: "ready",
            progress: 0,
            error: null,
            s3Key: null,
            contentType: null,
          });
        }
      }

      if (accepted.length) {
        setFiles((cur) => [...cur, ...accepted]);

        messages.push({
          tone: "success",
          text: `${accepted.length} file${accepted.length === 1 ? "" : "s"} added. Documents upload when you submit the claim.`,
        });
      }

      setFileMessages(messages);
    },
    [files]
  );

  const removeFile = useCallback((id) => {
    setFiles((cur) => cur.filter((file) => file.id !== id));
    setFileMessages([]);
  }, []);

  const patchFile = (id, patch) => {
    setFiles((cur) =>
      cur.map((file) =>
        file.id === id
          ? { ...file, ...patch }
          : file
      )
    );
  };

  const reset = useCallback(() => {
    setStep(1);
    setForm(EMPTY_FORM);
    setTouched({});
    setAttempted(false);
    setFiles([]);
    setFileMessages([]);
    setSubmitError("");
    claimIdRef.current = null;
  }, []);

  const errors = validateClaim(form);

  // Upload every file that is not already uploaded.
  // Preserve successful uploads and their S3 keys across retries.
  const submit = useCallback(
    async (onReady) => {
      if (submittingRef.current) return;

      if (Object.keys(validateClaim(form)).length > 0) {
        setAttempted(true);
        setStep(1);
        return;
      }

      if (files.length === 0) {
        setStep(2);
        return;
      }

      submittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError("");

      // Reuse the same claim ID when retrying.
      if (!claimIdRef.current) {
        claimIdRef.current = newClaimId();
      }

      const claimId = claimIdRef.current;

      // Local map ensures newly uploaded S3 keys are available
      // immediately, without waiting for React state updates.
      const uploadedDocuments = new Map(
        files.map((file) => [
          file.id,
          {
            key: file.s3Key,
            contentType: file.contentType,
          },
        ])
      );

      let failed = 0;

      for (const entry of files.filter(
        (file) => file.status !== "done"
      )) {
        patchFile(entry.id, {
          status: "uploading",
          progress: 0,
          error: null,
        });

        try {
          const uploaded = await uploadDocument(
            entry.file,
            (progress) =>
              patchFile(entry.id, {
                progress,
              })
          );

          // Save the returned S3 key immediately.
          uploadedDocuments.set(entry.id, {
            key: uploaded.key,
            contentType: uploaded.contentType,
          });

          patchFile(entry.id, {
            status: "done",
            progress: 1,
            s3Key: uploaded.key,
            contentType: uploaded.contentType,
          });
        } catch (error) {
          failed += 1;

          patchFile(entry.id, {
            status: "error",
            error: error.message || "Upload failed.",
          });
        }
      }

      submittingRef.current = false;
      setIsSubmitting(false);

      if (failed > 0) {
        setSubmitError(
          `${failed} document${failed === 1 ? "" : "s"} failed to upload, so no screening was run and the claim was not registered. Retry to upload only the failed files.`
        );

        return;
      }

      // Pass the S3 object keys to the next stage.
      onReady({
        claimId,

        claim: toClaimSnapshot(form),

        documents: files.map((file) => {
          const uploaded = uploadedDocuments.get(file.id);

          return {
            name: file.file.name,
            size: file.file.size,
            type: uploaded?.contentType || file.file.type,
            s3Key: uploaded?.key || file.s3Key,
          };
        }),
      });

      reset();
    },
    [files, form, reset]
  );

  return {
    step,
    setStep,
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

    isSubmitting,
    submitError,
    submit,
    reset,
  };
}
