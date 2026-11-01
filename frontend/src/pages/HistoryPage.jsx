import { Callout, Card, EmptyState, PageHeader } from "../components/ui";
import { OutcomeBadge } from "./OverviewPage";
import { formatDateTime, formatINR } from "../lib/format";
import { summarize } from "../lib/screening";

export default function HistoryPage({ records, navigate }) {
  return (
    <>
      <PageHeader
        eyebrow="CLAIM HISTORY"
        title="Claim history"
        description="Claims screened in this browser session."
      />
      <Callout tone="info">
        <strong>Session-only view.</strong> Persistent history is not connected: there is no API in this frontend for listing stored claims. These rows live in this tab's memory, are not shared with other users, and disappear when you refresh. Claims already registered in the backend are not listed here.
      </Callout>

      <Card className="mt">
        {records.length === 0 ? (
          <EmptyState
            icon="history"
            title="Nothing screened yet"
            action={<button type="button" className="btn btn-primary" onClick={() => navigate("/new")}>Submit a new claim</button>}
          >
            Submit a claim and it will be listed here for the rest of this session.
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
                {records.map((r) => (
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
      </Card>
    </>
  );
}
