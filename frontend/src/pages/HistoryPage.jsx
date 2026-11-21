import { useState } from "react";
import Icon from "../components/Icon";
import { Callout, Card, EmptyState, PageHeader } from "../components/ui";
import { OutcomeBadge } from "./OverviewPage";
import { formatDateTime, formatINR } from "../lib/format";
import { filterHistoryRecords, summarize } from "../lib/screening";

export default function HistoryPage({ records, navigate }) {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const filteredRecords = filterHistoryRecords(records, { query, outcome, sortOrder });

  function clearFilters() {
    setQuery("");
    setOutcome("all");
    setSortOrder("newest");
  }

  return (
    <>
      <PageHeader
        eyebrow="CLAIM HISTORY"
        title="Claim history"
        description="Claims you have screened in this session."
      />
      <Callout tone="info">
        <strong>Session history.</strong> Claims shown here are held in memory and clear on refresh. Previously stored backend claims are not listed yet.
      </Callout>

      <Card className="mt">
        {records.length === 0 ? (
          <EmptyState
            icon="history"
            title="Nothing screened yet"
            action={<button type="button" className="btn btn-primary" onClick={() => navigate("/new")}>Submit a new claim</button>}
          >
            Submit a claim and it will be listed here with its outcome.
          </EmptyState>
        ) : (
          <>
            <div className="history-toolbar" role="search" aria-label="Filter claim history">
              <label className="history-search">
                <Icon name="search" size={17} />
                <span className="sr-only">Search claim history</span>
                <input
                  type="search"
                  placeholder="Search policy, claim ID, or type"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="history-select">
                <span>Outcome</span>
                <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                  <option value="all">All outcomes</option>
                  <option value="review">Review needed</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="progress">In progress</option>
                  <option value="clear">Clear checks</option>
                </select>
              </label>
              <label className="history-select">
                <span>Sort</span>
                <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>
            <p className="history-result-count" role="status">
              Showing {filteredRecords.length} of {records.length} claim{records.length === 1 ? "" : "s"}
            </p>
            {filteredRecords.length === 0 ? (
              <EmptyState
                icon="search"
                title="No claims match these filters"
                action={<button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>}
              >
                Try another search term or outcome.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="data-table responsive">
                  <thead>
                    <tr>
                      <th>Submitted</th><th>Claim ID</th><th>Policy</th><th>Type</th><th className="num">Amount</th><th>Outcome</th><th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => (
                      <tr key={r.id}>
                        <td data-label="Submitted">{formatDateTime(r.submittedAt)}</td>
                        <td data-label="Claim ID"><code>{r.id}</code></td>
                        <td data-label="Policy">{r.claim.policyNumber}</td>
                        <td data-label="Type">{r.claim.claimType}</td>
                        <td data-label="Amount" className="num">{formatINR(r.claim.claimAmountINR)}</td>
                        <td data-label="Outcome"><OutcomeBadge summary={summarize(r.checks)} /></td>
                        <td className="row-action">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/results/${encodeURIComponent(r.id)}`)}>
                            View results
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
