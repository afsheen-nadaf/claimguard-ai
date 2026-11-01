import { useCallback, useRef, useState } from "react";
import { UPLOAD_RULES } from "../api/config";
import { uploadDocument } from "../api/claims";
import { EMPTY_FORM, newClaimId, toClaimSnapshot, validateClaim } from "../lib/validation";
import { formatBytes } from "../lib/format";

let fileCounter = 0;

// Holds the in-progress claim so the user can move between steps (or even
// other pages) without losing what they typed or selected.
export function useClaimDraft() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [files, setFiles] = useState([]); // { id, file, status, progress, error }
  const [fileMessages, setFileMessages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);
  const claimIdRef = useRef(null);

  const setField = useCallback((key, value) => setForm((cur) => ({ ...cur, [key]: value })), []);
  const touch = useCallback((key) => setTouched((cur) => ({ ...cur, [key]: true })), []);

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList || []);
      const accepted = [];
      const messages = [];
      for (const file of incoming) {
        const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
        const typeOk = UPLOAD_RULES.allowedTypes.includes(file.type) || UPLOAD_RULES.allowedExtensions.includes(ext);
        const same = (e) => e.file.name === file.name && e.file.size === file.size && e.file.lastModified === file.lastModified;
        if (!typeOk) {
          messages.push({ tone: "error", text: `${file.name}: only PDF, JPG, JPEG or PNG files are accepted.` });
        } else if (file.size === 0) {
          messages.push({ tone: "error", text: `${file.name}: the file is empty.` });
        } else if (file.size > UPLOAD_RULES.maxBytes) {
          messages.push({ tone: "error", text: `${file.name} (${formatBytes(file.size)}): exceeds the 10 MB limit.` });
        } else if (files.some(same) || accepted.some(same)) {
          messages.push({ tone: "error", text: `${file.name}: already added.` });
        } else {
          accepted.push({ id: `f${++fileCounter}`, file, status: "ready", progress: 0, error: null });
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
    [files],
  );

  const removeFile = useCallback((id) => {
    setFiles((cur) => cur.filter((f) => f.id !== id));
    setFileMessages([]);
  }, []);

  const patchFile = (id, patch) => setFiles((cur) => cur.map((f) => (f.id === id ? { ...f, ...patch } : f)));

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

  // Uploads every file that is not already uploaded, then hands off to onReady.
  // Nothing is registered or screened unless every upload succeeded.
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

      // The same ID is reused if the user retries after a failure.
      if (!claimIdRef.current) claimIdRef.current = newClaimId();
      const claimId = claimIdRef.current;

      let failed = 0;
      for (const entry of files.filter((f) => f.status !== "done")) {
        patchFile(entry.id, { status: "uploading", progress: 0, error: null });
        try {
          await uploadDocument(entry.file, (p) => patchFile(entry.id, { progress: p }));
          patchFile(entry.id, { status: "done", progress: 1 });
        } catch (error) {
          failed += 1;
          patchFile(entry.id, { status: "error", error: error.message || "Upload failed." });
        }
      }

      submittingRef.current = false;
      setIsSubmitting(false);

      if (failed > 0) {
        setSubmitError(
          `${failed} document${failed === 1 ? "" : "s"} failed to upload, so no screening was run and the claim was not registered. Retry to upload only the failed files.`,
        );
        return;
      }

      onReady({
        claimId,
        claim: toClaimSnapshot(form),
        documents: files.map((f) => ({ name: f.file.name, size: f.file.size, type: f.file.type })),
      });
      reset();
    },
    [files, form, reset],
  );

  return {
    step, setStep, form, setField, touched, touch, attempted, setAttempted, errors,
    files, fileMessages, addFiles, removeFile,
    isSubmitting, submitError, submit, reset,
  };
}
