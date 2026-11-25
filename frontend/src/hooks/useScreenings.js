import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchClaimHistory,
  persistScreeningResult,
  submitClaim,
  waitForPipeline,
} from "../api/claims";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER } from "../lib/screening";

const STORAGE_KEY = "claimguard_screenings";
const PAGE_SIZE = 50;
// Default to backend Step Functions pipeline unless explicitly disabled.
const USE_PIPELINE = import.meta.env.VITE_USE_PIPELINE !== "false";
// Everything except the browser-only consistency check runs in the pipeline.
const PIPELINE_KEYS = CHECK_ORDER.filter((key) => key !== "consistency");

function storageKey(userId) {
  return `${STORAGE_KEY}:${userId}`;
}

function loadFromStorage(userId) {
  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (!stored) return [];
    const records = JSON.parse(stored);
    if (Array.isArray(records)) return records;
    console.error("[useScreenings] Stored claim history is not an array.");
  } catch (error) {
    console.error("[useScreenings] Could not load claim history from storage:", error);
  }
  return [];
}

function saveToStorage(userId, records) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(records));
  } catch (error) {
    console.error("[useScreenings] Could not save claim history to storage:", error);
  }
}

function mapCloudClaim(claim, role) {
  const savedResults = claim.screeningResults || {};
  const pipelineComplete = claim.screeningStatus === "COMPLETE";
  const isActivelyRunning = claim.screeningStatus === "RUNNING";
  const checks = Object.fromEntries(
    CHECK_ORDER.map((key) => {
      const saved = savedResults[key];
      let check = saved?.check
        ? { ...saved.check, persistenceSource: saved.source }
        : key === "consistency" && pipelineComplete
          ? {
              status: "done",
              raw: { skipped: true, reason: "BROWSER_ONLY" },
              result: {
                status: "clear",
                headline: "Not run in background pipeline",
                summary: "Cross-document consistency runs during interactive document upload.",
                details: [],
              },
              error: null,
            }
          : {
              status: isActivelyRunning ? "running" : "unavailable",
              raw: null,
              result: null,
              error: null,
            };

      // The pipeline saves `raw` only, so interpret it here.
      if (check.status === "done" && check.raw && !check.result) {
        try {
          check = { ...check, result: CHECKS[key].interpret(check.raw) };
        } catch (error) {
          console.error(`[useScreenings] Could not interpret saved ${key} result:`, error);
          check = { ...check, status: "error", error: "Saved result could not be displayed." };
        }
      }
      if (key === "duplicate" && role === "adjuster" && saved?.check) {
        const raw = {
          ...(saved.check.raw || {}),
          matches: claim.duplicateMatches || [],
          matchCount: claim.duplicateMatchCount || 0,
          imageMatches: claim.duplicateImageMatches || [],
          imageMatchCount: claim.duplicateImageMatchCount || 0,
        };
        check = {
          ...check,
          raw,
          result: CHECKS.duplicate.interpret(raw),
        };
      }
      return [key, check];
    })
  );
  const claimIdTime = claim.claimId?.match(/-(\d{13})(?:-|$)/)?.[1];
  const submittedAt =
    Date.parse(claim.createdAt || "") ||
    (claimIdTime ? Number(claimIdTime) : Date.parse(claim.incidentDate || "")) ||
    Date.now();
  return {
    id: claim.claimId,
    submittedAt,
    screeningStatus: claim.screeningStatus || "UNAVAILABLE",
    aiAssessment: claim.aiAssessment || null,
    claim: {
      claimantName: claim.claimantName || "",
      policyNumber: claim.policyNumber || "",
      claimType: claim.claimType || "General",
      incidentDate: claim.incidentDate || "",
      claimAmountINR: claim.claimAmountINR,
    },
    documents: Array.isArray(claim.documents)
      ? claim.documents.map((doc) => ({
          ...doc,
          s3Key: doc.s3Key || doc.key || "",
          type: doc.type || doc.contentType || "",
          name: doc.name || (doc.key ? doc.key.split("/").pop() : "Document"),
        }))
      : [],
    checks,
    cloudRecord: true,
  };
}

function mergeChecks(existingChecks = {}, incomingChecks = {}) {
  const merged = { ...existingChecks };
  for (const key of CHECK_ORDER) {
    const existing = existingChecks[key];
    const incoming = incomingChecks[key];
    if (!incoming) continue;

    // Never let an "unavailable" placeholder overwrite an active or finished local check.
    if (
      incoming.status === "unavailable" &&
      existing &&
      ["running", "pending", "done", "error"].includes(existing.status)
    ) {
      continue;
    }

    // Preserve interactive cross-document consistency results over background placeholders.
    if (
      key === "consistency" &&
      existing?.status === "done" &&
      !existing?.raw?.skipped
    ) {
      continue;
    }

    merged[key] = incoming;
  }
  return merged;
}

function mergeDocuments(existingDocs = [], incomingDocs = []) {
  if (!incomingDocs.length) return existingDocs;
  const existingByKey = new Map(
    existingDocs
      .map((d) => [d.s3Key || d.key || d.name, d])
      .filter(([k]) => Boolean(k))
  );
  return incomingDocs.map((doc) => {
    const key = doc.s3Key || doc.key || doc.name;
    const prev = key ? existingByKey.get(key) : null;
    return {
      ...prev,
      ...doc,
      s3Key: doc.s3Key || doc.key || prev?.s3Key || "",
      type: doc.type || doc.contentType || prev?.type || "",
      extractedData: doc.extractedData ?? prev?.extractedData ?? null,
    };
  });
}

function mergeRecords(current, incoming) {
  const byId = new Map(current.map((record) => [record.id, record]));
  for (const record of incoming) {
    const existing = byId.get(record.id);
    if (!existing) {
      byId.set(record.id, record);
    } else {
      byId.set(record.id, {
        ...existing,
        ...record,
        screeningStatus:
          record.screeningStatus && record.screeningStatus !== "UNAVAILABLE"
            ? record.screeningStatus
            : existing.screeningStatus,
        aiAssessment: record.aiAssessment || existing.aiAssessment || null,
        claim: {
          ...existing.claim,
          ...record.claim,
          claimantName: record.claim?.claimantName || existing.claim?.claimantName || "",
        },
        documents: mergeDocuments(existing.documents, record.documents),
        checks: mergeChecks(existing.checks, record.checks),
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.submittedAt - a.submittedAt);
}

export function useScreenings(userId, role) {
  const [recordsByUser, setRecordsByUser] = useState(() =>
    userId ? { [userId]: loadFromStorage(userId) } : {}
  );
  const records = userId
    ? Object.prototype.hasOwnProperty.call(recordsByUser, userId)
      ? recordsByUser[userId]
      : loadFromStorage(userId)
    : [];
  const setRecords = useCallback(
    (update) => {
      if (!userId) return;
      setRecordsByUser((current) => {
        const previous = Object.prototype.hasOwnProperty.call(current, userId)
          ? current[userId]
          : loadFromStorage(userId);
        const next = typeof update === "function" ? update(previous) : update;
        return { ...current, [userId]: next };
      });
    },
    [userId]
  );
  const [fetchedUsers, setFetchedUsers] = useState(() => new Set());
  const awsFetched = Boolean(userId && fetchedUsers.has(userId));
  const setAwsFetched = useCallback(
    (fetched) => {
      if (!userId) return;
      setFetchedUsers((current) => {
        const next = new Set(current);
        if (fetched) next.add(userId);
        else next.delete(userId);
        return next;
      });
    },
    [userId]
  );
  const [cursorsByUser, setCursorsByUser] = useState({});
  const nextCursor = userId ? cursorsByUser[userId] || null : null;
  const setNextCursor = useCallback(
    (cursor) => {
      if (!userId) return;
      setCursorsByUser((current) => ({ ...current, [userId]: cursor }));
    },
    [userId]
  );
  const [loadingMoreByUser, setLoadingMoreByUser] = useState({});
  const isLoadingMore = Boolean(userId && loadingMoreByUser[userId]);
  const setIsLoadingMore = useCallback(
    (loading) => {
      if (!userId) return;
      setLoadingMoreByUser((current) => ({ ...current, [userId]: loading }));
    },
    [userId]
  );
  const inflight = useRef(new Set());

  useEffect(() => {
    if (!userId || !Object.prototype.hasOwnProperty.call(recordsByUser, userId)) return;
    saveToStorage(userId, recordsByUser[userId]);
  }, [recordsByUser, userId]);

  const applyPage = useCallback(
    (result) => {
      setRecords((current) =>
        mergeRecords(current, (result.claims || []).map((claim) => mapCloudClaim(claim, role)))
      );
      setNextCursor(result.nextCursor || null);
      return result;
    },
    [role, setNextCursor, setRecords]
  );

  const loadPage = useCallback(
    async (cursor = null) =>
      applyPage(await fetchClaimHistory(PAGE_SIZE, cursor)),
    [applyPage]
  );

  useEffect(() => {
    if (!userId || awsFetched) return;
    let active = true;
    fetchClaimHistory(PAGE_SIZE)
      .then((result) => {
        if (active) applyPage(result);
      })
      .catch((error) => {
        console.error("[useScreenings] Failed to fetch claim history:", error);
        toast.error(`Could not load claim history: ${error.message}`);
      })
      .finally(() => {
        if (active) setAwsFetched(true);
      });
    return () => {
      active = false;
    };
  }, [applyPage, awsFetched, setAwsFetched, userId]);

  const loadClaim = useCallback(
    async (claimId) => {
      const result = await fetchClaimHistory(1, null, claimId);
      const record = (result.claims || []).map((claim) => mapCloudClaim(claim, role))[0];
      if (record) setRecords((current) => mergeRecords(current, [record]));
      return record || null;
    },
    [role, setRecords]
  );

  // Auto-poll recent actively running cloud claims so adjuster/claimant views
  // update automatically once the Step Functions pipeline writes results to DynamoDB.
  const hasRunningClaims = records.some(
    (r) =>
      r.cloudRecord &&
      r.screeningStatus === "RUNNING" &&
      Date.now() - r.submittedAt < 15 * 60 * 1000
  );

  useEffect(() => {
    if (!userId || !hasRunningClaims) return;
    const interval = setInterval(() => {
      fetchClaimHistory(PAGE_SIZE)
        .then((result) => applyPage(result))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [applyPage, hasRunningClaims, userId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await loadPage(nextCursor);
    } catch (error) {
      console.error("[useScreenings] Could not load the next history page:", error);
      toast.error(`Could not load more claims: ${error.message}`);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, loadPage, nextCursor, setIsLoadingMore]);

  const refreshClaim = useCallback(
    async (claimId) => {
      const result = await fetchClaimHistory(1, null, claimId);
      const cloud = (result.claims || []).map((claim) => mapCloudClaim(claim, role))[0];
      if (!cloud) throw new Error("Screening finished, but its results could not be loaded.");
      setRecords((current) => mergeRecords(current, [cloud]));
    },
    [role, setRecords]
  );

  const patchCheck = useCallback((id, key, patch) => {
    setRecords((current) =>
      current.map((record) =>
        record.id === id
          ? {
              ...record,
              checks: {
                ...record.checks,
                [key]: {
                  ...record.checks[key],
                  ...patch,
                },
              },
            }
          : record
      )
    );
  }, [setRecords]);

  const runCheck = useCallback(
    async (id, key, claim, documents = []) => {
      const token = `${id}:${key}`;
      if (inflight.current.has(token)) return;
      inflight.current.add(token);
      patchCheck(id, key, { status: "running", error: null });

      try {
        const raw = await CHECKS[key].run(id, claim, documents);
        const checkResult = {
          status: "done",
          raw,
          result: CHECKS[key].interpret(raw),
          error: null,
          finishedAt: Date.now(),
        };
        patchCheck(id, key, checkResult);
        if (role === "adjuster" || key === "consistency") {
          try {
            await persistScreeningResult(id, key, checkResult);
            patchCheck(id, key, { persistenceSource: "authenticated-client" });
          } catch (error) {
            console.error(`[useScreenings] Could not persist ${key} result:`, error);
            patchCheck(id, key, { persistenceError: error.message });
            if (role === "adjuster") {
              toast.error(`${CHECKS[key].title} completed, but its result was not saved to claim history.`);
            }
          }
        }
      } catch (error) {
        const checkResult = {
          status: "error",
          result: null,
          raw: error.body ?? null,
          error: error.message || "The check could not be completed.",
          finishedAt: Date.now(),
        };
        patchCheck(id, key, checkResult);
        if (role === "adjuster" || key === "consistency") {
          try {
            await persistScreeningResult(id, key, checkResult);
          } catch (persistError) {
            console.error(`[useScreenings] Could not persist failed ${key} result:`, persistError);
            patchCheck(id, key, { persistenceError: persistError.message });
          }
        }
      } finally {
        inflight.current.delete(token);
      }
    },
    [patchCheck, role]
  );

  // Backend pipeline: submit once, poll until Step Functions finishes, then
  // pull the system-written results back from DynamoDB.
  const runPipeline = useCallback(
    async (claimId, claim, documents) => {
      const token = `${claimId}:pipeline`;
      if (inflight.current.has(token)) return;
      inflight.current.add(token);
      PIPELINE_KEYS.forEach((key) =>
        patchCheck(claimId, key, { status: "running", error: null })
      );
      try {
        await submitClaim(claimId, claim, documents);
        const outcome = await waitForPipeline(claimId);
        if (outcome.status !== "COMPLETE") {
          throw new Error(outcome.cause || outcome.error || "Screening did not complete.");
        }
        await refreshClaim(claimId);
        if (CHECK_ORDER.includes("consistency")) {
          let latestDocs = documents;
          setRecords((current) => {
            const found = current.find((r) => r.id === claimId);
            if (found?.documents?.length) latestDocs = found.documents;
            return current;
          });
          await runCheck(claimId, "consistency", claim, latestDocs);
        }
      } catch (error) {
        PIPELINE_KEYS.forEach((key) =>
          patchCheck(claimId, key, {
            status: "error",
            result: null,
            error: error.message || "Screening could not be completed.",
          })
        );
        toast.error(`Screening failed: ${error.message}`);
      } finally {
        inflight.current.delete(token);
      }
    },
    [patchCheck, refreshClaim, runCheck, setRecords]
  );

  const start = useCallback(
    ({ claimId, claim, documents = [] }) => {
      const checks = Object.fromEntries(
        CHECK_ORDER.map((key) => [
          key,
          { status: "running", result: null, raw: null, error: null },
        ])
      );
      setRecords((current) =>
        mergeRecords(current, [{
          id: claimId,
          submittedAt: Date.now(),
          screeningStatus: "RUNNING",
          aiAssessment: null,
          claim,
          documents,
          checks,
        }])
      );

      const runAllChecks = async () => {
        if (CHECK_ORDER.includes("duplicate")) {
          await runCheck(claimId, "duplicate", claim, documents);
        }
        await Promise.all(
          CHECK_ORDER.filter((key) => key !== "duplicate").map((key) =>
            runCheck(claimId, key, claim, documents)
          )
        );
      };
      if (USE_PIPELINE) runPipeline(claimId, claim, documents);
      else runAllChecks();
    },
    [runCheck, runPipeline, setRecords]
  );

  const retry = useCallback(
    (record, key) => {
      if (USE_PIPELINE && key !== "consistency") {
        toast("Pipeline checks re-run automatically. Submit a new claim to re-screen.");
        return;
      }
      return runCheck(record.id, key, record.claim, record.documents || []);
    },
    [runCheck]
  );

  return {
    records,
    start,
    retry,
    loadMore,
    hasMore: Boolean(nextCursor),
    isLoadingMore,
    loadClaim,
    isHistoryLoading: !awsFetched,
  };
}