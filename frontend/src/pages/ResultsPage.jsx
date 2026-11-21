import { useState } from "react";
import toast from "react-hot-toast";
import Icon from "../components/Icon";
import Stepper from "../components/Stepper";
import RiskScoreMeter from "../components/RiskScoreMeter";
import CompactCheckCard from "../components/CompactCheckCard";
import { Card, EmptyState, KeyValueList, PageHeader } from "../components/ui";
import ConsistencyResult from "../components/results/ConsistencyResult";
import DuplicateResult from "../components/results/DuplicateResult";
import EvidenceResult from "../components/results/EvidenceResult";
import OutlierResult from "../components/results/OutlierResult";
import PolicyResult from "../components/results/PolicyResult";
import ImageForensicsSection from "../components/results/forensics/ImageForensicsSection";
import { CHECKS } from "../lib/checks";
import { calculateRiskScore, summarize } from "../lib/screening";
import { formatBytes, formatDate, formatDateTime, formatINR } from "../lib/format";

export default function ResultsPage({ record, onRetry, navigate }) {
  const [copied, setCopied] = useState(false);

  if (!record) {
    return (
      <>
        <PageHeader eyebrow="SCREENING RESULTS" title="Results not available" />
        <Card>
          <EmptyState
            icon="history"
            title="We couldn't find these results"
            action={<button type="button" className="btn btn-primary" onClick={() => navigate("/new")}>Submit a new claim</button>}
          >
            The results may have been cleared when the page was refreshed. Submit the claim again to re-run screening.
          </EmptyState>
        </Card>
      </>
    );
  }

  const summary = summarize(record.checks);
  const riskScore = calculateRiskScore(record.checks);
  const { claim } = record;

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

  return (
    <>
      <PageHeader
        eyebrow="SCREENING RESULTS"
        title="Screening results"
        description={
          <>
            Claim ID <code>{record.id}</code>{" "}
            <button type="button" className="link-button" onClick={copyId}>{copied ? "Copied" : "Copy"}</button>
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate("/new")}>
            <Icon name="filePlus" size={17} /> Screen another claim
          </button>
        }
      />
      <Stepper current={3} />

      <div className="results-top">
        <div className="risk-panel-compact">
          <h3>Risk Score</h3>
          <RiskScoreMeter score={riskScore} />
          <p className="risk-interpretation-compact">
            {riskScore <= 30 && "Low risk"}
            {riskScore > 30 && riskScore <= 60 && "Review recommended"}
            {riskScore > 60 && "High risk - priority review"}
          </p>
        </div>
        <div className={`summary-panel-compact summary-${summary.tone}`}>
          <h3>{summary.title}</h3>
          <p>{summary.text}</p>
        </div>
      </div>

      <div className="checks-bento">
        <CompactCheckCard
          check={record.checks.policy}
          title={CHECKS.policy.title}
          icon={CHECKS.policy.icon}
        >
          <PolicyResult
            result={record.checks.policy.result || {}}
            policyNumber={claim.policyNumber}
          />
        </CompactCheckCard>

        <CompactCheckCard
          check={record.checks.duplicate}
          title={CHECKS.duplicate.title}
          icon={CHECKS.duplicate.icon}
          badgeLabel={
            record.checks.duplicate.result?.kind === "no_match" ? "No match"
              : record.checks.duplicate.result?.kind === "review" ? "Potential duplicate"
              : undefined
          }
        >
          <DuplicateResult result={record.checks.duplicate.result || {}} claimId={record.id} />
        </CompactCheckCard>

        <CompactCheckCard
          check={record.checks.outlier}
          title={CHECKS.outlier.title}
          icon={CHECKS.outlier.icon}
        >
          <OutlierResult result={record.checks.outlier.result || { metrics: {}, details: [] }} claim={claim} />
        </CompactCheckCard>

        <CompactCheckCard
          check={record.checks.forensics}
          title={CHECKS.forensics.title}
          icon={CHECKS.forensics.icon}
        >
          <ImageForensicsSection
            record={record}
            check={record.checks.forensics}
            onRetry={() => onRetry(record, "forensics")}
            compact
          />
        </CompactCheckCard>

        <CompactCheckCard
          check={record.checks.evidence}
          title={CHECKS.evidence.title}
          icon={CHECKS.evidence.icon}
        >
          <EvidenceResult result={record.checks.evidence.result || {}} />
        </CompactCheckCard>

        <CompactCheckCard
          check={record.checks.consistency}
          title={CHECKS.consistency.title}
          icon={CHECKS.consistency.icon}
        >
          <ConsistencyResult result={record.checks.consistency.result || {}} />
        </CompactCheckCard>
      </div>

      <div className="two-col">
        <div className="claim-meta-sidebar">
          <h3>Claim Details</h3>
          <KeyValueList
            items={[
              { label: "Submitted", value: formatDateTime(record.submittedAt) },
              { label: "Policy", value: claim.policyNumber },
              { label: "Type", value: claim.claimType },
              { label: "Date", value: formatDate(claim.incidentDate) },
              { label: "Amount", value: formatINR(claim.claimAmountINR) },
              { label: "Location", value: claim.location },
            ]}
          />
        </div>
        <div className="claim-meta-sidebar">
          <h3>Documents ({record.documents.length})</h3>
          <ul className="doc-list">
            {record.documents.map((d, i) => (
              <li key={`${d.name}-${i}`}>
                <Icon name={d.type === "application/pdf" ? "file" : "image"} size={16} />
                <span title={d.name}>{d.name}</span>
                <span className="muted small">{formatBytes(d.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
