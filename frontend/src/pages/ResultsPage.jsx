import { useState } from "react";
import toast from "react-hot-toast";
import { fetchDocumentViewUrl } from "../api/claims";
import Icon from "../components/Icon";
import RiskScoreMeter from "../components/RiskScoreMeter";
import StickyNavSidebar from "../components/StickyNavSidebar";
import Breadcrumbs from "../components/Breadcrumbs";
import ScrollProgress from "../components/ScrollProgress";
import Timeline from "../components/Timeline";
import { Card, EmptyState, KeyValueList, PageHeader, StatusBadge } from "../components/ui";
import ConsistencyResult from "../components/results/ConsistencyResult";
import DuplicateResult from "../components/results/DuplicateResult";
import EvidenceResult from "../components/results/EvidenceResult";
import OutlierResult from "../components/results/OutlierResult";
import PolicyResult from "../components/results/PolicyResult";
import ImageForensicsSection from "../components/results/forensics/ImageForensicsSection";
import { CHECKS } from "../lib/checks";
import {
  calculateRiskScore,
  CHECK_ORDER,
  getChecksNeedingAttention,
  normalizeSkippedForensics,
  summarize,
} from "../lib/screening";
import { formatBytes, formatDate, formatDateTime, formatINR } from "../lib/format";

export default function ResultsPage({ record, onRetry, navigate }) {
  const [copied, setCopied] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [loadingDocKey, setLoadingDocKey] = useState(null);

  if (!record) {
    return (
      <div className="min-h-screen bg-[#0f0b14] p-8">
        <PageHeader eyebrow="SCREENING RESULTS" title="Results not available" />
        <Card>
          <EmptyState
            icon="history"
            title="We couldn't find these results"
            action={
              <button
                type="button"
                className="px-5 py-2.5 bg-[#251d33] text-purple-100 border border-purple-700/30 rounded-xl font-semibold hover:bg-[#2d2440] transition-all"
                onClick={() => navigate("/history")}
              >
                Back to claim history
              </button>
            }
          >
            This claim is not available in the signed-in account. It may belong to another user or have been removed.
          </EmptyState>
        </Card>
      </div>
    );
  }

  if (!record.checks || CHECK_ORDER.some((key) => !record.checks[key])) {
    return (
      <div className="min-h-screen bg-[#0f0b14] p-8">
        <PageHeader eyebrow="SCREENING RESULTS" title="Detailed results unavailable" />
        <Card>
          <EmptyState
            icon="info"
            title={`Claim #${record.id} is in AWS history`}
            action={
              <button
                type="button"
                className="px-5 py-2.5 bg-[#251d33] text-purple-100 border border-purple-700/30 rounded-xl font-semibold hover:bg-[#2d2440] transition-all"
                onClick={() => navigate("/history")}
              >
                Back to claims
              </button>
            }
          >
            This claim does not have a complete persisted screening snapshot. Missing checks are unavailable, not passes.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const screeningChecks = normalizeSkippedForensics(record);
  const summary = summarize(screeningChecks);
  const riskScore = calculateRiskScore(screeningChecks);
  const { claim } = record;
  const policyHolderName = screeningChecks.policy?.raw?.policyHolderName || null;
  const checksNeedingAttention = getChecksNeedingAttention(screeningChecks);
  const firstFlaggedCheck = checksNeedingAttention.find(
    (key) => screeningChecks[key].result?.state === "review"
  );
  const firstRetryableCheck = checksNeedingAttention.find(
    (key) =>
      screeningChecks[key].status === "error" ||
      screeningChecks[key].result?.state === "inconclusive"
  );

  function scrollToCheck(key) {
    document.getElementById(`section-${key}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(record.id);
      setCopied(true);
      toast.success("Claim ID copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  async function handleViewDocument(doc) {
    const docKey = doc.s3Key || doc.key;
    if (!docKey) {
      toast.error("File preview is unavailable for this entry.");
      return;
    }
    setLoadingDocKey(docKey);
    try {
      const data = await fetchDocumentViewUrl(record.id, docKey);
      setPreviewDoc({
        url: data.url,
        name: doc.name || data.name,
        contentType: doc.type || doc.contentType || data.contentType || "",
      });
    } catch (error) {
      toast.error(error.message || "Could not load document preview.");
    } finally {
      setLoadingDocKey(null);
    }
  }

  const checks = [
    { id: "policy", label: "Policy", check: screeningChecks.policy, gradient: "from-purple-900 to-purple-800" },
    { id: "duplicate", label: "Duplicate", check: screeningChecks.duplicate, gradient: "from-purple-800 to-purple-700" },
    { id: "outlier", label: "Outlier", check: screeningChecks.outlier, gradient: "from-purple-700 to-purple-600" },
    { id: "forensics", label: "Forensics", check: screeningChecks.forensics, gradient: "from-purple-600 to-purple-500" },
    { id: "evidence", label: "Evidence", check: screeningChecks.evidence, gradient: "from-purple-500 to-purple-400" },
    { id: "consistency", label: "Consistency", check: screeningChecks.consistency, gradient: "from-purple-400 to-purple-300" },
  ];

  const flaggedChecks = checks.filter((c) => c.check.result?.state === "review");
  const passedChecks = checks.filter((c) => c.check.result?.state === "pass");
  const skippedChecks = checks.filter((c) => c.check.result?.state === "skipped");

  const timelineEvents = [
    { icon: "upload", title: "Claim Submitted", time: formatDateTime(record.submittedAt), type: "info" },
    { icon: "play", title: "Screening Started", time: formatDateTime(record.submittedAt), type: "info" },
    ...checks.map(c => ({
      icon: c.check.result?.state === "pass" ? "checkCircle" : c.check.result?.state === "review" ? "alertTriangle" : c.check.result?.state === "skipped" ? "info" : "clock",
      title: `${CHECKS[c.id].title} ${c.check.result?.state === "pass" ? "Passed" : c.check.result?.state === "review" ? "Flagged" : c.check.result?.state === "skipped" ? "Skipped" : "Completed"}`,
      time: formatDateTime(record.submittedAt),
      type: c.check.result?.state === "pass" ? "success" : c.check.result?.state === "review" ? "warning" : "info",
    })),
    { icon: "flag", title: "Ready for Review", time: formatDateTime(record.submittedAt), type: "warning" },
  ];

  const breadcrumbItems = [
    { label: "Overview", icon: "home", href: "/", onClick: () => navigate("/") },
    { label: "History", icon: "history", href: "/history", onClick: () => navigate("/history") },
    { label: record.id, icon: "file" },
  ];

  return (
    <div className="min-h-screen bg-[#0f0b14]">
      <ScrollProgress />
      {CHECK_ORDER.some(
        (key) => screeningChecks[key]?.persistenceSource === "authenticated-client"
      ) && (
        <div className="mx-auto mt-4 max-w-[1920px] px-6">
          <div
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            role="note"
          >
            Saved screening output is a browser-submitted snapshot, not an independently attested decision. Verify signals against the source evidence.
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="bg-[#1a1425]/40 backdrop-blur-sm border-b border-purple-900/10">
        <div className="max-w-[1920px] mx-auto px-6 py-3">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-[#1a1425]/95 backdrop-blur-xl border-b border-purple-800/20 shadow-2xl">
        <div className="max-w-[1920px] mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <span className="inline-block text-[10px] font-bold tracking-[0.15em] text-purple-400 uppercase mb-2">
                Claim Screening Results
              </span>
              <h1 className="text-3xl font-bold text-white tracking-tight mb-3 truncate">
                Claim #{record.id}
              </h1>
              <div className="flex items-center gap-4 flex-wrap text-sm">
                {claim.claimantName && (
                  <>
                    <span className="flex items-center gap-2 text-purple-100">
                      <Icon name="user" size={14} className="text-purple-300" />
                      <span className="font-semibold">{claim.claimantName}</span>
                    </span>
                    <span className="text-purple-700">•</span>
                  </>
                )}
                <span className="flex items-center gap-2 text-purple-200">
                  <Icon name="calendar" size={14} className="text-purple-300" />
                  <span className="font-medium">{formatDateTime(record.submittedAt)}</span>
                </span>
                <span className="text-purple-700">•</span>
                <span className="flex items-center gap-2 text-purple-200">
                  <Icon name="clipboard" size={14} className="text-purple-300" />
                  <span className="font-medium">{claim.policyNumber}</span>
                </span>
                <span className="text-purple-700">•</span>
                <span className="flex items-center gap-2 text-purple-200">
                  <Icon name="tag" size={14} className="text-purple-300" />
                  <span className="font-medium">{claim.claimType}</span>
                </span>
                <span className="text-purple-700">•</span>
                <button
                  type="button"
                  className="flex items-center gap-2 text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                  onClick={copyId}
                >
                  <Icon name="copy" size={14} />
                  {copied ? "Copied!" : "Copy ID"}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                className="px-4 py-2.5 bg-[#251d33] text-purple-100 border border-purple-700/30 rounded-xl font-semibold hover:bg-[#2d2440] hover:border-purple-600/50 transition-all flex items-center gap-2"
                onClick={() => navigate("/history")}
              >
                <Icon name="arrowLeft" size={16} />
                <span className="hidden sm:inline">Back to Queue</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-[1920px] mx-auto flex">
        {/* Sidebar */}
        <StickyNavSidebar
          riskScore={riskScore}
          flaggedChecks={flaggedChecks}
          passedChecks={passedChecks}
          skippedChecks={skippedChecks}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-6 py-10 lg:px-12">
          {/* Overview Section */}
          <section id="section-overview" data-section className="mb-16 scroll-mt-32">
            <div className="grid lg:grid-cols-[420px,1fr] gap-6">
              {/* Risk Assessment Card */}
              <div className="bg-gradient-to-br from-[#1a1425] to-[#251d33] backdrop-blur-xl border border-purple-700/30 rounded-2xl p-8 shadow-2xl">
                <h2 className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-purple-300 uppercase mb-6">
                  <Icon name="chart" size={15} className="text-purple-400" />
                  <span>Risk Assessment</span>
                </h2>
                <RiskScoreMeter score={riskScore} />
                <div className="mt-6 text-center space-y-3">
                  <div className="text-3xl font-bold text-white">{riskScore} <span className="text-xl text-purple-300">/ 100</span></div>
                  <div className="text-sm text-purple-200 leading-relaxed px-4">
                    {riskScore <= 30 && "Low Risk - No immediate concerns detected"}
                    {riskScore > 30 && riskScore <= 60 && "Medium Risk - Manual review recommended"}
                    {riskScore > 60 && "High Risk - Priority review required"}
                  </div>
                </div>

                {/* Risk Breakdown */}
                {riskScore > 0 && (
                  <div className="mt-6 pt-6 border-t border-purple-700/30">
                    <div className="text-[10px] font-bold tracking-wider text-purple-400 uppercase mb-3">
                      Risk Contributors
                    </div>
                    <div className="space-y-2">
                      {screeningChecks.policy?.result?.state === "review" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-purple-200">Policy Issues</span>
                          <span className="text-amber-400 font-semibold">+40</span>
                        </div>
                      )}
                      {screeningChecks.duplicate?.result?.state === "review" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-purple-200">Duplicate Found</span>
                          <span className="text-amber-400 font-semibold">+30</span>
                        </div>
                      )}
                      {screeningChecks.outlier?.result?.state === "review" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-purple-200">Amount Outlier</span>
                          <span className="text-amber-400 font-semibold">+25</span>
                        </div>
                      )}
                      {screeningChecks.forensics?.result?.state === "review" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-purple-200">Image Forensics</span>
                          <span className="text-amber-400 font-semibold">+35</span>
                        </div>
                      )}
                      {screeningChecks.evidence?.result?.state === "review" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-purple-200">Evidence Mismatch</span>
                          <span className="text-amber-400 font-semibold">+30</span>
                        </div>
                      )}
                      {screeningChecks.consistency?.result?.state === "review" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-purple-200">Inconsistencies</span>
                          <span className="text-amber-400 font-semibold">+20</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Card */}
              <div className="bg-gradient-to-br from-[#1a1425] to-[#251d33] backdrop-blur-xl border border-purple-700/30 rounded-2xl p-8 shadow-2xl">
                <h2 className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-purple-300 uppercase mb-6">
                  <Icon name="info" size={15} className="text-purple-400" />
                  <span>Summary</span>
                </h2>
                <div className={`flex items-start gap-4 p-5 rounded-2xl mb-6 border-l-4 ${
                  summary.tone === "success" ? "bg-emerald-950/40 border-emerald-500" :
                  "bg-amber-950/40 border-amber-500"
                }`}>
                  <Icon
                    name={summary.tone === "success" ? "checkCircle" : "alert"}
                    size={24}
                    className={`flex-shrink-0 ${
                      summary.tone === "success" ? "text-emerald-400" :
                      "text-amber-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg text-[#f5f0e8] mb-2">{summary.title}</div>
                    <div className="text-sm text-[#f5f0e8] leading-relaxed">{summary.text}</div>
                  </div>
                </div>
                <div className="mb-6 p-4 rounded-xl border border-purple-700/30 bg-purple-950/30">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                    <Icon name="arrow" size={16} className="text-purple-300" />
                    Recommended next action
                  </h3>
                  <p className="text-sm text-purple-200 leading-relaxed">{summary.next}</p>
                  {summary.key === "review" && firstFlaggedCheck && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-white transition-colors"
                      onClick={() => scrollToCheck(firstFlaggedCheck)}
                    >
                      Review {CHECKS[firstFlaggedCheck].title}
                      <Icon name="arrow" size={14} />
                    </button>
                  )}
                  {["partial", "failed"].includes(summary.key) &&
                    firstRetryableCheck &&
                    onRetry && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-white transition-colors"
                        onClick={() => onRetry(record, firstRetryableCheck)}
                      >
                        Retry {CHECKS[firstRetryableCheck].title}
                        <Icon name="refresh" size={14} />
                      </button>
                    )}
                  {summary.key === "clear" && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-white transition-colors"
                      onClick={() => navigate("/history")}
                    >
                      Return to claim history
                      <Icon name="arrow" size={14} />
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {/* Amount - Horizontal on top */}
                  <div className="text-center p-4 bg-purple-950/60 rounded-2xl border border-purple-800/50">
                    <div className="text-2xl font-bold text-[#f5f0e8] mb-1">{formatINR(claim.claimAmountINR)}</div>
                    <div className="text-[10px] text-purple-300 uppercase tracking-wider font-semibold">Claim Amount</div>
                  </div>
                  {/* Flagged and Passed - 2 columns below */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-purple-950/60 rounded-2xl border border-purple-800/50">
                      <div className="text-3xl font-bold text-amber-400 mb-1">{flaggedChecks.length}</div>
                      <div className="text-[10px] text-purple-300 uppercase tracking-wider font-semibold">Flagged</div>
                    </div>
                    <div className="text-center p-4 bg-purple-950/60 rounded-2xl border border-purple-800/50">
                      <div className="text-3xl font-bold text-emerald-400 mb-1">{passedChecks.length}</div>
                      <div className="text-[10px] text-purple-300 uppercase tracking-wider font-semibold">Passed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grounded AI Narrative Synthesis */}
            {record.aiAssessment && (
              <div className="mt-6 bg-gradient-to-br from-[#1a1425] to-[#251d33] backdrop-blur-xl border border-purple-700/30 rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <h2 className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-purple-300 uppercase">
                    <Icon name="clipboard" size={15} className="text-purple-400" />
                    <span>AI Narrative Synthesis</span>
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-purple-950/80 text-purple-200 border border-purple-700/40">
                    {record.aiAssessment.posture === "CLEAR_SIGNALS" && "Clear Signals"}
                    {record.aiAssessment.posture === "SINGLE_INDICATOR" && "Single Indicator"}
                    {record.aiAssessment.posture === "MULTI_SIGNAL_REVIEW" && "Multi-Signal Review"}
                  </span>
                </div>

                <p className="text-sm text-[#f5f0e8] leading-relaxed mb-5">
                  {record.aiAssessment.executiveSummary}
                </p>

                {Array.isArray(record.aiAssessment.groundedObservations) &&
                  record.aiAssessment.groundedObservations.length > 0 && (
                    <div className="mb-5">
                      <div className="text-[11px] font-bold tracking-wider text-purple-300 uppercase mb-2.5">
                        Grounded Cross-Check Findings
                      </div>
                      <ul className="space-y-2">
                        {record.aiAssessment.groundedObservations.map((obs, idx) => (
                          <li
                            key={`${obs.check}-${idx}`}
                            className="flex items-start gap-3 p-3 rounded-xl bg-purple-950/50 border border-purple-800/40 text-sm"
                          >
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase flex-shrink-0 mt-0.5">
                              {obs.check}
                            </span>
                            <span className="text-purple-100 leading-relaxed">{obs.finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {Array.isArray(record.aiAssessment.recommendedAdjusterActions) &&
                  record.aiAssessment.recommendedAdjusterActions.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[11px] font-bold tracking-wider text-purple-300 uppercase mb-2.5">
                        Suggested Verification Steps
                      </div>
                      <ul className="space-y-1.5">
                        {record.aiAssessment.recommendedAdjusterActions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-sm text-purple-200">
                            <Icon name="checkCircle" size={15} className="text-purple-400 flex-shrink-0 mt-0.5" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {record.aiAssessment.disclaimer && (
                  <p className="pt-3 border-t border-purple-800/40 text-xs text-purple-400">
                    {record.aiAssessment.disclaimer}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Check Sections */}
          {checks.map(({ id, check, gradient }) => (
            <section key={id} id={`section-${id}`} data-section className="mb-12 scroll-mt-32">
              <div className="flex items-start gap-5 mb-6 pb-5 border-b border-purple-800/30">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-xl flex-shrink-0`}>
                  <Icon name={CHECKS[id].icon} size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-white mb-2 capitalize">{CHECKS[id].title}</h2>
                  <p className="text-sm text-[#f5f0e8] leading-relaxed">
                    {CHECKS[id].description}
                  </p>
                </div>
                <StatusBadge
                  state={check.result?.state || check.status}
                  label={
                    check.result?.state === "skipped"
                      ? "Skipped · no images"
                      : check.result?.kind === "skipped"
                        ? "Skipped"
                        : undefined
                  }
                />
              </div>
              <div className="bg-gradient-to-br from-[#1a1425]/80 to-[#251d33]/60 backdrop-blur-md border border-purple-700/30 rounded-2xl p-8 shadow-xl">
                {id === "policy" && <PolicyResult result={check.result || {}} policyNumber={claim.policyNumber} />}
                {id === "duplicate" && <DuplicateResult result={check.result || {}} claimId={record.id} />}
                {id === "outlier" && <OutlierResult result={check.result || { metrics: {}, details: [] }} claim={claim} />}
                {id === "forensics" && <ImageForensicsSection record={record} check={check} onRetry={() => onRetry(record, "forensics")} />}
                {id === "evidence" && <EvidenceResult result={check.result || {}} />}
                {id === "consistency" && <ConsistencyResult result={check.result || {}} />}
              </div>
            </section>
          ))}

          {/* Details Section */}
          <section id="section-details" data-section className="mb-12 scroll-mt-32">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
              <Icon name="file" size={22} className="text-purple-400" />
              <span>Claim Details &amp; Documents</span>
            </h2>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Claim Information */}
              <div className="bg-gradient-to-br from-[#1a1425]/80 to-[#251d33]/60 backdrop-blur-md border border-purple-700/30 rounded-2xl p-8 shadow-xl">
                <h3 className="flex items-center gap-3 text-lg font-bold text-white mb-6">
                  <Icon name="info" size={20} className="text-purple-400" />
                  Claim Information
                </h3>
                <KeyValueList
                  items={[
                    { label: "Claimant Name", value: claim.claimantName || "—" },
                    ...(policyHolderName
                      ? [{ label: "Policyholder on Record", value: policyHolderName }]
                      : []),
                    { label: "Submitted", value: formatDateTime(record.submittedAt) },
                    { label: "Policy Number", value: claim.policyNumber },
                    { label: "Claim Type", value: claim.claimType },
                    { label: "Incident Date", value: formatDate(claim.incidentDate) },
                    { label: "Claim Amount", value: formatINR(claim.claimAmountINR) },
                    { label: "Location", value: claim.location },
                  ]}
                />
              </div>

              {/* Documents */}
              <div className="bg-gradient-to-br from-[#1a1425]/80 to-[#251d33]/60 backdrop-blur-md border border-purple-700/30 rounded-2xl p-8 shadow-xl">
                <h3 className="flex items-center gap-3 text-lg font-bold text-white mb-6">
                  <Icon name="file" size={20} className="text-purple-400" />
                  Documents <span className="text-sm font-normal text-purple-300">({record.documents.length})</span>
                </h3>
                <ul className="space-y-3">
                  {record.documents.map((d, i) => {
                    const docKey = d.s3Key || d.key;
                    const docType = d.type || d.contentType || "";
                    const isPdf =
                      docType === "application/pdf" ||
                      d.name?.toLowerCase().endsWith(".pdf");
                    return (
                      <li
                        key={`${d.name}-${i}`}
                        className="flex items-center gap-3 p-4 bg-purple-950/60 border border-purple-800/50 rounded-xl hover:bg-purple-900/60 hover:border-purple-700/50 transition-all group"
                      >
                        <div
                          className={`w-12 h-12 rounded-lg bg-gradient-to-br ${
                            i % 6 === 0
                              ? "from-purple-900 to-purple-800"
                              : i % 6 === 1
                              ? "from-purple-800 to-purple-700"
                              : i % 6 === 2
                              ? "from-purple-700 to-purple-600"
                              : i % 6 === 3
                              ? "from-purple-600 to-purple-500"
                              : i % 6 === 4
                              ? "from-purple-500 to-purple-400"
                              : "from-purple-400 to-purple-300"
                          } flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                        >
                          <Icon name={isPdf ? "file" : "image"} size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-white truncate">{d.name}</div>
                          <div className="text-xs text-purple-400 flex items-center gap-2 mt-1">
                            <span className="truncate">{docType || "Document"}</span>
                            {typeof d.size === "number" && (
                              <>
                                <span>•</span>
                                <span>{formatBytes(d.size)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {docKey && (
                          <button
                            type="button"
                            disabled={loadingDocKey === docKey}
                            onClick={() => handleViewDocument(d)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-800/60 text-purple-100 border border-purple-600/40 hover:bg-purple-700/70 hover:text-white transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                          >
                            <Icon name="eye" size={14} />
                            <span>{loadingDocKey === docKey ? "Loading..." : "View"}</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {previewDoc && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setPreviewDoc(null)}
                  >
                    <div
                      className="bg-[#1a1425] border border-purple-700/40 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-purple-800/40">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{previewDoc.name}</h4>
                          <p className="text-xs text-purple-400">{previewDoc.contentType}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <a
                            href={previewDoc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-900/60 text-purple-200 border border-purple-700/40 hover:bg-purple-800 transition-colors"
                          >
                            Open in new tab
                          </a>
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#251d33] text-purple-100 border border-purple-700/40 hover:bg-[#2d2440] transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#0f0b14]">
                        {previewDoc.contentType === "application/pdf" ||
                        previewDoc.name?.toLowerCase().endsWith(".pdf") ? (
                          <iframe
                            src={previewDoc.url}
                            title={previewDoc.name}
                            className="w-full h-[72vh] rounded-xl border border-purple-800/40 bg-white"
                          />
                        ) : (
                          <img
                            src={previewDoc.url}
                            alt={previewDoc.name}
                            className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-lg"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="lg:col-span-2 bg-gradient-to-br from-[#1a1425]/80 to-[#251d33]/60 backdrop-blur-md border border-purple-700/30 rounded-2xl p-8 shadow-xl">
                <h3 className="flex items-center gap-3 text-lg font-bold text-white mb-6">
                  <Icon name="clock" size={20} className="text-purple-400" />
                  Activity Timeline
                </h3>
                <Timeline events={timelineEvents} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}