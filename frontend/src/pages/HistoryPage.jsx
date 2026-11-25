import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Icon from "../components/Icon";
import { Callout, Card, EmptyState, PageHeader } from "../components/ui";
import { OutcomeBadge } from "./OverviewPage";
import { formatDateTime, formatINR } from "../lib/format";
import {
  CHECK_ORDER,
  filterHistoryRecords,
  normalizeSkippedForensics,
  summarizeRecord,
} from "../lib/screening";

const FILTER_STORAGE_KEY = "claimguard_history_filters";
const DEFAULT_FILTERS = { query: "", outcome: "all", sortOrder: "newest" };
const OUTCOME_FILTERS = ["all", "review", "incomplete", "progress", "clear", "skipped", "unavailable"];

function HistoryFilterDropdown({ id, label, value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(320);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!dropdownRef.current?.contains(event.target)) setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    menuRef.current?.querySelector('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen]);

  function handleMenuKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll('[role="menuitemradio"]') || []
    );
    const currentIndex = items.indexOf(document.activeElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[nextIndex]?.focus();
  }

  function selectOption(optionValue) {
    onChange(optionValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function toggleMenu() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const bounds = triggerRef.current?.getBoundingClientRect();
    if (bounds) {
      const spaceBelow = window.innerHeight - bounds.bottom;
      const spaceAbove = bounds.top;
      const desiredHeight = Math.min(options.length * 40 + 12, 320);
      const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
      setOpensUp(openAbove);
      setMenuMaxHeight(
        Math.max(120, Math.min(desiredHeight, Math.max(spaceAbove, spaceBelow) - 16))
      );
    }
    setIsOpen(true);
  }

  return (
    <div ref={dropdownRef} className="history-dropdown">
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        className="history-filter-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            toggleMenu();
          }
        }}
      >
        <span>{selectedOption.label}</span>
        <Icon
          name="chevron"
          size={16}
          className={`text-purple-300 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          className={`history-filter-menu ${opensUp ? "opens-up" : ""}`}
          role="menu"
          aria-labelledby={`${id}-trigger`}
          style={{ maxHeight: `${menuMaxHeight}px` }}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="history-filter-option"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => selectOption(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function readSavedFilters() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!stored) return DEFAULT_FILTERS;

    const parsed = JSON.parse(stored);
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      outcome: OUTCOME_FILTERS.includes(parsed.outcome) ? parsed.outcome : "all",
      sortOrder: ["newest", "oldest"].includes(parsed.sortOrder)
        ? parsed.sortOrder
        : "newest",
    };
  } catch (error) {
    console.error("[HistoryPage] Could not load saved filters:", error);
    return DEFAULT_FILTERS;
  }
}

export default function HistoryPage({
  records,
  navigate,
  role,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}) {
  const isClaimant = role === "claimant";
  const [filters, setFilters] = useState(readSavedFilters);
  const { query, outcome, sortOrder } = filters;
  const filteredRecords = filterHistoryRecords(records, {
    query,
    outcome: isClaimant ? "all" : outcome,
    sortOrder,
  });

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error("[HistoryPage] Could not save filters:", error);
    }
  }, [filters]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  async function copyClaimId(claimId) {
    try {
      await navigator.clipboard.writeText(claimId);
      toast.success("Claim ID copied");
    } catch (error) {
      console.error("[HistoryPage] Could not copy claim ID:", error);
      toast.error("Could not copy claim ID");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={isClaimant ? "MY SUBMISSIONS" : "ADJUSTER WORKSPACE"}
        title={isClaimant ? "My claims" : "Claims"}
        description={
          isClaimant
            ? "Track your submitted claims and inspect uploaded documents."
            : "Active screening queue and fraud indicators for adjuster review."
        }
      />

      <Callout tone="info">
        <strong className="font-semibold">Authenticated history.</strong>{" "}
        {isClaimant
          ? "Your submitted claims and uploaded files are synced with your account."
          : "Claims are loaded from your account; search, outcome, and sort preferences persist in this browser."}
      </Callout>

      <Card>
        {records.length === 0 ? (
          <EmptyState
            icon="history"
            title={isClaimant ? "No claims submitted yet" : "Nothing screened yet"}
            action={isClaimant ? (
              <button
                type="button"
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-500 hover:to-purple-600 transition-all shadow-lg"
                onClick={() => navigate("/new")}
              >
                Submit a new claim
              </button>
            ) : null}
          >
            {isClaimant
              ? "Submit a claim and it will appear here."
              : "Submit a claim and it will be listed here with its outcome."}
          </EmptyState>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-end gap-4 flex-wrap mb-5" role="search" aria-label="Filter claim history">
              <label className="relative flex items-center flex-1 min-w-[260px]">
                <Icon name="search" size={17} className="absolute left-3 text-purple-400 pointer-events-none" />
                <span className="sr-only">Search claim history</span>
                <input
                  type="search"
                  placeholder="Search policy, claim ID, or type"
                  value={query}
                  onChange={(event) => updateFilter("query", event.target.value)}
                  className="w-full min-h-[40px] pl-10 pr-3 py-2 bg-purple-950/40 border border-purple-700/40 rounded-lg text-white text-sm placeholder:text-purple-400 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/30 transition-colors"
                />
              </label>

              {!isClaimant && (
                <div className="flex flex-col gap-2 min-w-[170px]">
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Outcome</span>
                  <HistoryFilterDropdown
                    id="history-outcome"
                    label="Outcome"
                    value={outcome}
                    onChange={(value) => updateFilter("outcome", value)}
                    options={[
                      { value: "all", label: "All outcomes" },
                      { value: "review", label: "Review needed" },
                      { value: "incomplete", label: "Incomplete" },
                      { value: "progress", label: "In progress" },
                      { value: "clear", label: "Clear checks" },
                      { value: "skipped", label: "Checks skipped" },
                      { value: "unavailable", label: "Results unavailable" },
                    ]}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 min-w-[170px]">
                <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Sort</span>
                <HistoryFilterDropdown
                  id="history-sort"
                  label="Sort"
                  value={sortOrder}
                  onChange={(value) => updateFilter("sortOrder", value)}
                  options={[
                    { value: "newest", label: "Newest first" },
                    { value: "oldest", label: "Oldest first" },
                  ]}
                />
              </div>
            </div>

            <p className="text-xs text-purple-300 mb-3" role="status">
              Showing {filteredRecords.length} of {records.length} claim{records.length === 1 ? "" : "s"}
            </p>

            {filteredRecords.length === 0 ? (
              <EmptyState
                icon="search"
                title="No claims match these filters"
                action={
                  <button
                    type="button"
                    className="px-4 py-2 bg-[#251d33] text-purple-200 border border-purple-700/30 rounded-lg font-semibold hover:bg-[#2d2440] hover:border-purple-600/50 transition-all"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                }
              >
                Try another search term or filter.
              </EmptyState>
            ) : (
              <>
                <div className="w-full overflow-hidden border border-purple-700/30 rounded-xl">
                  <table className="history-table w-full border-collapse text-sm">
                    {!isClaimant && (
                      <colgroup>
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "23%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "6%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "9%" }} />
                      </colgroup>
                    )}
                    <thead>
                      <tr>
                        <th className="text-left text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-3 py-3 border-b border-purple-800/30 whitespace-nowrap rounded-tl-xl">
                          Submitted
                        </th>
                        <th className="text-left text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-3 py-3 border-b border-purple-800/30 whitespace-nowrap">
                          Claim ID
                        </th>
                        <th className="text-left text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-3 py-3 border-b border-purple-800/30 whitespace-nowrap">
                          Policy
                        </th>
                        <th className="text-left text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-3 py-3 border-b border-purple-800/30 whitespace-nowrap">
                          Type
                        </th>
                        <th className="text-right text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-3 py-3 border-b border-purple-800/30 whitespace-nowrap">
                          Amount
                        </th>
                        <th className="text-left text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-3 py-3 border-b border-purple-800/30 whitespace-nowrap">
                          {isClaimant ? "Status" : "Outcome"}
                        </th>
                        <th className="text-left text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-2 py-3 border-b border-purple-800/30 whitespace-nowrap">
                          Evidence
                        </th>
                        {!isClaimant && (
                          <th className="text-left text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-2 py-3 border-b border-purple-800/30 whitespace-nowrap">
                            Checks
                          </th>
                        )}
                        <th className="text-right text-[10.5px] font-bold tracking-wider uppercase text-[#f5f0e8] bg-purple-950/40 px-2 py-3 border-b border-purple-800/30 whitespace-nowrap rounded-tr-xl">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r) => {
                        const screeningChecks = normalizeSkippedForensics(r);
                        const summary = summarizeRecord(r);
                        const evidenceFiles = Array.isArray(r.documents) ? r.documents : [];
                        const imageCount = evidenceFiles.filter((file) =>
                          ["image/jpeg", "image/png"].includes(file.type) ||
                          /\.(jpe?g|png)$/i.test(file.name || "")
                        ).length;
                        const pdfCount = evidenceFiles.filter((file) =>
                          file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")
                        ).length;
                        const evidenceSummary =
                          !isClaimant && summary.key === "unavailable"
                            ? "Not available"
                            : evidenceFiles.length
                              ? `${pdfCount} PDF · ${imageCount} photo${imageCount === 1 ? "" : "s"}`
                              : "No files";
                        const skippedEntries = CHECK_ORDER
                          .map((key) => ({ key, check: screeningChecks[key] }))
                          .filter(
                            ({ check }) =>
                              check?.status === "done" && check?.result?.state === "skipped"
                          );
                        const finishedChecks = CHECK_ORDER.filter((key) => {
                          const check = screeningChecks[key];
                          if (!["done", "error"].includes(check?.status)) return false;
                          return check?.result?.state !== "skipped";
                        }).length;
                        const skipSummaryText = skippedEntries
                          .map(({ key, check }) => {
                            if (key === "forensics") return "Forensics skipped · no photos";
                            if (key === "consistency") {
                              const reason =
                                check?.result?.skipReason ||
                                `${check?.result?.documentsAnalyzed ?? 0} documents`;
                              return `Consistency skipped · ${reason}`;
                            }
                            return `${key} skipped`;
                          })
                          .join(" · ");

                        const isProcessing =
                          r.screeningStatus === "RUNNING" || summary.key === "progress";

                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-purple-950/20 transition-colors"
                          >
                            <td data-label="Submitted" className="px-3 py-3 border-b border-purple-900/20 align-middle text-purple-200">
                              {formatDateTime(r.submittedAt)}
                            </td>
                            <td data-label="Claim ID" className="claim-id-cell px-3 py-3 border-b border-purple-900/20 align-middle">
                              <div className="claim-id-content">
                                <code className="claim-id-code px-2 py-1 bg-purple-950 rounded text-xs text-purple-200 border border-purple-800" title={r.id}>
                                  {r.id}
                                </code>
                                <button
                                  type="button"
                                  className="p-2 text-purple-300 border border-purple-700/40 rounded-lg hover:text-white hover:bg-purple-800/40 transition-colors"
                                  aria-label={`Copy claim ID ${r.id}`}
                                  title="Copy claim ID"
                                  onClick={() => copyClaimId(r.id)}
                                >
                                  <Icon name="copy" size={14} />
                                </button>
                              </div>
                            </td>
                            <td data-label="Policy" className="px-3 py-3 border-b border-purple-900/20 align-middle text-purple-200">
                              {r.claim.claimantName && (
                                <div className="font-semibold text-white text-xs truncate" title={r.claim.claimantName}>
                                  {r.claim.claimantName}
                                </div>
                              )}
                              <span className="history-policy text-xs text-purple-300" title={r.claim.policyNumber}>
                                {r.claim.policyNumber}
                              </span>
                            </td>
                            <td data-label="Type" className="px-3 py-3 border-b border-purple-900/20 align-middle text-purple-200">
                              {r.claim.claimType}
                            </td>
                            <td data-label="Amount" className="px-3 py-3 border-b border-purple-900/20 align-middle text-right tabular-nums text-purple-200 whitespace-nowrap">
                              {formatINR(r.claim.claimAmountINR)}
                            </td>
                            <td data-label={isClaimant ? "Status" : "Outcome"} className="px-3 py-3 border-b border-purple-900/20 align-middle">
                              {isClaimant ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                    isProcessing
                                      ? "bg-purple-500/10 text-purple-200 border-purple-500/30"
                                      : "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isProcessing ? "bg-purple-400 animate-pulse" : "bg-emerald-400"
                                    }`}
                                  />
                                  {isProcessing ? "Processing" : "Submitted"}
                                </span>
                              ) : (
                                <OutcomeBadge summary={summary} />
                              )}
                            </td>
                            <td data-label="Evidence" className="px-2 py-3 border-b border-purple-900/20 align-middle text-purple-200">
                              <span className="history-evidence" title={evidenceSummary}>
                                {evidenceSummary}
                              </span>
                            </td>
                            {!isClaimant && (
                              <td data-label="Checks" className="px-2 py-3 border-b border-purple-900/20 align-middle text-purple-200">
                                {summary.key === "unavailable" ? (
                                  "Not available"
                                ) : (
                                  <div className="history-checks">
                                    <span className="whitespace-nowrap">{finishedChecks}/{CHECK_ORDER.length} completed</span>
                                    {skipSummaryText && (
                                      <span className="history-check-detail">{skipSummaryText}</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                            <td data-label="Actions" className="px-2 py-3 border-b border-purple-900/20 align-middle text-right">
                              <button
                                type="button"
                                className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap border ${
                                  isClaimant
                                    ? "bg-purple-800/50 text-purple-100 border-purple-600/40 hover:bg-purple-700/60 hover:text-white"
                                    : "px-1.5 bg-emerald-500/10 text-emerald-200 border-emerald-400/30 text-[10px] hover:bg-emerald-500/20 hover:border-emerald-300/50"
                                }`}
                                onClick={() => navigate(`/results/${encodeURIComponent(r.id)}`)}
                              >
                                {isClaimant ? "View submission" : "View results"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {hasMore && (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      className="rounded-xl border border-purple-700/40 bg-purple-950/30 px-5 py-2.5 text-sm font-semibold text-purple-100 transition-colors hover:bg-purple-900/40 disabled:cursor-wait disabled:opacity-60"
                      onClick={onLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? "Loading…" : "Load more claims"}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Card>
    </>
  );
}