import { useCallback, useRef, useState } from "react";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER } from "../lib/screening";

// Session-only store of screened claims (in memory; cleared on page refresh).
// Each check runs independently so one failure never hides the others.
export function useScreenings() {
  const [records, setRecords] = useState([]); // newest first
  const inflight = useRef(new Set());

  const patchCheck = (id, key, patch) =>
    setRecords((rs) =>
      rs.map((r) => (r.id === id ? { ...r, checks: { ...r.checks, [key]: { ...r.checks[key], ...patch } } } : r)),
    );

  const runCheck = useCallback(async (id, key, claim) => {
    const token = `${id}:${key}`;
    if (inflight.current.has(token)) return; // never fire the same call twice
    inflight.current.add(token);
    patchCheck(id, key, { status: "running", error: null });
    try {
      const raw = await CHECKS[key].run(id, claim);
      patchCheck(id, key, { status: "done", raw, result: CHECKS[key].interpret(raw), error: null, finishedAt: Date.now() });
    } catch (error) {
      patchCheck(id, key, {
        status: "error",
        result: null,
        raw: error.body ?? null,
        error: error.message || "The check could not be completed.",
        finishedAt: Date.now(),
      });
    } finally {
      inflight.current.delete(token);
    }
  }, []);

  const start = useCallback(
    ({ claimId, claim, documents }) => {
      const checks = {};
      for (const key of CHECK_ORDER) checks[key] = { status: "running", result: null, raw: null, error: null };
      setRecords((rs) => [{ id: claimId, submittedAt: Date.now(), claim, documents, checks }, ...rs]);
      for (const key of CHECK_ORDER) runCheck(claimId, key, claim);
    },
    [runCheck],
  );

  const retry = useCallback((record, key) => runCheck(record.id, key, record.claim), [runCheck]);

  return { records, start, retry };
}
