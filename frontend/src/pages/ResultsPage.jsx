import { useState } from "react";
import Icon from "../components/Icon";
import Stepper from "../components/Stepper";
import { Card, EmptyState, KeyValueList, PageHeader } from "../components/ui";
import CheckCard from "../components/results/CheckCard";
import ConsistencyResult from "../components/results/ConsistencyResult";
import DuplicateResult from "../components/results/DuplicateResult";
import EvidenceResult from "../components/results/EvidenceResult";
import OutlierResult from "../components/results/OutlierResult";
import PolicyResult from "../components/results/PolicyResult";
import SummaryPanel from "../components/results/SummaryPanel";
import ImageForensicsSection from "../components/results/forensics/ImageForensicsSection";
import { CHECKS } from "../lib/checks";
import { summarize } from "../lib/screening";
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
  const { claim } = record;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(record.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable; the ID is still visible on screen */
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

      <SummaryPanel summary={summary} checks={record.checks} />

      <div className="results-grid">
        <CheckCard
          id="check-policy"
          title={CHECKS.policy.title}
          icon={CHECKS.policy.icon}
          check={record.checks.policy}
          onRetry={() => onRetry(record, "policy")}
        >
          <PolicyResult
            result={record.checks.policy.result || {}}
            policyNumber={claim.policyNumber}
          />
        </CheckCard>

        <CheckCard
          id="check-duplicate"
          title={CHECKS.duplicate.title}
          icon={CHECKS.duplicate.icon}
          check={record.checks.duplicate}
          onRetry={() => onRetry(record, "duplicate")}
          badgeLabel={
            record.checks.duplicate.result?.kind === "no_match" ? "No match found"
              : record.checks.duplicate.result?.kind === "review" ? "Potential duplicate"
              : record.checks.duplicate.result?.kind === "already_registered" ? "Already registered"
              : undefined
          }
        >
          <DuplicateResult result={record.checks.duplicate.result || {}} claimId={record.id} />
        </CheckCard>

        <CheckCard
          id="check-outlier"
          title={CHECKS.outlier.title}
          icon={CHECKS.outlier.icon}
          check={record.checks.outlier}
          onRetry={() => onRetry(record, "outlier")}
          wide
        >
          <OutlierResult result={record.checks.outlier.result || { metrics: {}, details: [] }} claim={claim} />
        </CheckCard>
      </div>

      <ImageForensicsSection
        record={record}
        check={record.checks.forensics}
        onRetry={() => onRetry(record, "forensics")}
      />

      <div className="results-grid">
        <CheckCard
          id="check-evidence"
          title={CHECKS.evidence.title}
          icon={CHECKS.evidence.icon}
          check={record.checks.evidence}
          onRetry={() => onRetry(record, "evidence")}
          wide
        >
          <EvidenceResult result={record.checks.evidence.result || {}} />
        </CheckCard>
      </div>

      <div className="results-grid">
        <CheckCard
          id="check-consistency"
          title={CHECKS.consistency.title}
          icon={CHECKS.consistency.icon}
          check={record.checks.consistency}
          onRetry={() => onRetry(record, "consistency")}
          wide
        >
          <ConsistencyResult result={record.checks.consistency.result || {}} />
        </CheckCard>
      </div>

      <div className="results-meta">
        <Card title="Submitted claim" icon="file">
          <KeyValueList
            items={[
              { label: "Submitted", value: formatDateTime(record.submittedAt) },
              { label: "Claim type", value: claim.claimType },
              { label: "Policy number", value: claim.policyNumber },
              { label: "Incident date", value: formatDate(claim.incidentDate) },
              { label: "Claim amount", value: formatINR(claim.claimAmountINR) },
              { label: "Location", value: claim.location },
              { label: "Description", value: claim.description },
            ]}
          />
        </Card>
        <Card title={`Uploaded documents (${record.documents.length})`} icon="upload">
          <ul className="doc-list">
            {record.documents.map((d, i) => (
              <li key={`${d.name}-${i}`}>
                <Icon name={d.type === "application/pdf" ? "file" : "image"} size={18} />
                <span title={d.name}>{d.name}</span>
                <span className="muted small">{formatBytes(d.size)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Stored in private S3 storage. Evidence relevance and image forensics read image/PDF contents for screening.</p>
        </Card>
      </div>
    </>
  );
}
