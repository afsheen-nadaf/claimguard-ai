
import { useCallback, useEffect, useRef, useState } from "react";
import { CHECKS } from "../lib/checks";
import { CHECK_ORDER } from "../lib/screening";
import { fetchClaimHistory } from "../api/claims";

// Persistent store of screened claims with localStorage backup.
// Each check runs independently.
const STORAGE_KEY = "claimguard_screenings";

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const records = JSON.parse(stored);
    if (Array.isArray(records)) return records;

    console.error("[useScreenings] Stored claim history is not an array.");
    return [];
  } catch (error) {
    console.error("[useScreenings] Could not load claim history from storage:", error);
    return [];
  }
}

function saveToStorage(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error("[useScreenings] Could not save claim history to storage:", error);
  }
}

export function useScreenings() {
  const [records, setRecords] = useState(() => {
    const loaded = loadFromStorage();
    console.log('[useScreenings] Loaded from storage:', loaded.length, 'records');
    return loaded;
  });
  const [awsFetched, setAwsFetched] = useState(false);
  const inflight = useRef(new Set());

  // Persist the resolved state, not the updater function passed to setState.
  useEffect(() => {
    saveToStorage(records);
  }, [records]);

  // Fetch claims from AWS on mount and merge with localStorage.
  useEffect(() => {
    if (awsFetched) return;

    const fetchFromAWS = async () => {
      try {
        console.log('[useScreenings] Fetching claims from AWS...');
        const result = await fetchClaimHistory(50);
        const awsClaims = result.claims || [];
        console.log('[useScreenings] Fetched from AWS:', awsClaims.length, 'claims');

        if (awsClaims.length > 0) {
          const fetchedRecords = awsClaims.map((claim) => ({
            id: claim.claimId,
            submittedAt: new Date(
              claim.claimId.split("-")[1] || Date.now()
            ).getTime(),
            claim: {
              policyNumber: claim.policyNumber,
              claimType: claim.claimType || "Unknown",
              incidentDate: claim.incidentDate,
              claimAmountINR: claim.claimAmountINR,
            },
            documents: [],
            checks: {},
          }));

          setRecords((currentRecords) => {
            const localIds = new Set(currentRecords.map((record) => record.id));
            const newClaims = fetchedRecords.filter(
              (record) => !localIds.has(record.id)
            );

            if (newClaims.length === 0) return currentRecords;

            console.log('[useScreenings] Merged', newClaims.length, 'new claims from AWS');
            return [...currentRecords, ...newClaims];
          });
        }
        setAwsFetched(true);
      } catch (error) {
        console.error('[useScreenings] Failed to fetch from AWS:', error);
        setAwsFetched(true); // Don't retry indefinitely
      }
    };

    fetchFromAWS();
  }, [awsFetched]);

  const updateRecords = useCallback((newRecords) => {
    setRecords(newRecords);
  }, []);

  const patchCheck = useCallback(
    (id, key, patch) => {
      updateRecords((rs) =>
        rs.map((r) =>
          r.id === id
            ? {
                ...r,
                checks: {
                  ...r.checks,
                  [key]: {
                    ...r.checks[key],
                    ...patch,
                  },
                },
              }
            : r
        )
      );
    },
    [updateRecords]
  );

  const runCheck = useCallback(
    async (id, key, claim, documents = []) => {
      const token = `${id}:${key}`;

      if (inflight.current.has(token)) return;

      inflight.current.add(token);

      patchCheck(id, key, {
        status: "running",
        error: null,
      });

      try {
        const raw = await CHECKS[key].run(
          id,
          claim,
          documents
        );

        patchCheck(id, key, {
          status: "done",
          raw,
          result: CHECKS[key].interpret(raw),
          error: null,
          finishedAt: Date.now(),
        });
      } catch (error) {
        patchCheck(id, key, {
          status: "error",
          result: null,
          raw: error.body ?? null,
          error:
            error.message ||
            "The check could not be completed.",
          finishedAt: Date.now(),
        });
      } finally {
        inflight.current.delete(token);
      }
    },
    [patchCheck]
  );

  const start = useCallback(
    ({ claimId, claim, documents = [] }) => {
      const checks = {};

      for (const key of CHECK_ORDER) {
        checks[key] = {
          status: "running",
          result: null,
          raw: null,
          error: null,
        };
      }

      updateRecords((rs) => [
        {
          id: claimId,
          submittedAt: Date.now(),
          claim,
          documents,
          checks,
        },
        ...rs,
      ]);

      for (const key of CHECK_ORDER) {
        runCheck(claimId, key, claim, documents);
      }
    },
    [runCheck, updateRecords]
  );

  // Reuse the original documents and S3 keys when retrying.
  const retry = useCallback(
    (record, key) =>
      runCheck(
        record.id,
        key,
        record.claim,
        record.documents || []
      ),
    [runCheck]
  );

  return {
    records,
    start,
    retry,
  };
}
