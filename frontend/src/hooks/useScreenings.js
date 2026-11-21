import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { fetchClaimHistory, persistScreeningResult } from "../api/claims";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER } from "../lib/screening";

const STORAGE_KEY = "claimguard_screenings";
const PAGE_SIZE = 50;

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
  const checks = Object.fromEntries(
    CHECK_ORDER.map((key) => {
      const saved = savedResults[key];
      let check = saved?.check
        ? { ...saved.check, persistenceSource: saved.source }
        : { status: "unavailable", raw: null, result: null, error: null };
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
      return [
        key,
        check,
      ];
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
    claim: {
      policyNumber: claim.policyNumber || "",
      claimType: claim.claimType || "Unknown",
      incidentDate: claim.incidentDate || "",
      claimAmountINR: claim.claimAmountINR,
    },
    documents: Array.isArray(claim.documents) ? claim.documents : [],
    checks,
    cloudRecord: true,
  };
}

function mergeRecords(current, incoming) {
  const byId = new Map(current.map((record) => [record.id, record]));
  for (const record of incoming) {
    if (!byId.has(record.id)) byId.set(record.id, record);
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

  const loadClaim = useCallback(
    async (claimId) => {
      const result = await fetchClaimHistory(1, null, claimId);
      const record = (result.claims || []).map((claim) => mapCloudClaim(claim, role))[0];
      if (record) setRecords((current) => mergeRecords(current, [record]));
      return record || null;
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
        try {
          await persistScreeningResult(id, key, checkResult);
          patchCheck(id, key, { persistenceSource: "authenticated-client" });
        } catch (error) {
          console.error(`[useScreenings] Could not persist ${key} result:`, error);
          patchCheck(id, key, { persistenceError: error.message });
          toast.error(`${CHECKS[key].title} completed, but its result was not saved to claim history.`);
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
        try {
          await persistScreeningResult(id, key, checkResult);
        } catch (persistError) {
          console.error(`[useScreenings] Could not persist failed ${key} result:`, persistError);
          patchCheck(id, key, { persistenceError: persistError.message });
        }
      } finally {
        inflight.current.delete(token);
      }
    },
    [patchCheck]
  );

  const start = useCallback(
    ({ claimId, claim, documents = [] }) => {
      const checks = Object.fromEntries(
        CHECK_ORDER.map((key) => [
          key,
          { status: "pending", result: null, raw: null, error: null },
        ])
      );
      setRecords((current) =>
        mergeRecords(current, [{
          id: claimId,
          submittedAt: Date.now(),
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
      runAllChecks();
    },
    [runCheck, setRecords]
  );

  const retry = useCallback(
    (record, key) =>
      runCheck(record.id, key, record.claim, record.documents || []),
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
