import Icon from "../Icon";
import { Callout, KeyValueList } from "../ui";

const FLAG_TONE = {
  DATE_MISMATCH: "warning",
  AMOUNT_MISMATCH: "warning",
  POLICY_NUMBER_MISMATCH: "warning",
  CLAIM_TYPE_MISMATCH: "warning",
  CLAIMANT_MISMATCH: "warning",
  CLAIM_NUMBER_MISMATCH: "warning",
  DUPLICATE_INVOICE: "danger",
};

export default function ConsistencyResult({ result }) {
  if (!result) return null;

  if (result.kind === "skipped") {
    return (
      <Callout tone="info">
        <strong>Cross-document comparison skipped.</strong>
        <p>{result.label}</p>
        <p className="muted small">
          Upload at least two documents with extractable data to enable cross-document consistency checking.
        </p>
      </Callout>
    );
  }

  const flags = result.flags || [];
  const summary = result.summary;

  if (flags.length === 0) {
    return (
      <>
        <KeyValueList
          items={[
            { label: "Documents analyzed", value: result.documentsAnalyzed || 0 },
            { label: "Comparable fields checked", value: summary?.comparableFieldsChecked || 0 },
            { label: "Inconsistencies found", value: 0 },
          ]}
        />
        <Callout tone="success">
          <strong>All documents are consistent.</strong>
          <p className="small">
            Every comparable field (policy number, incident date, claim amount, claim type, claimant name, claim number)
            matches across all uploaded documents. No duplicate invoice numbers were found within this upload set.
          </p>
        </Callout>
      </>
    );
  }

  return (
    <div className="stack-sm">
      <KeyValueList
        items={[
          { label: "Documents analyzed", value: result.documentsAnalyzed || 0 },
          { label: "Comparable fields checked", value: summary?.comparableFieldsChecked || 0 },
          { label: "Inconsistencies found", value: flags.length },
        ]}
      />

      <Callout tone="warning">
        <strong>{flags.length} inconsistency{flags.length === 1 ? "" : "ies"} detected.</strong>
        <p className="small">
          Fields extracted from different documents do not match. An analyst should compare the
          flagged documents before making any decision. Mismatches may result from extraction errors,
          document versions, or intentional discrepancies.
        </p>
      </Callout>

      <div className="consistency-flags">
        {flags.map((flag, idx) => {
          const tone = FLAG_TONE[flag.code] || "warning";
          const entries = Object.entries(flag.values || {});

          return (
            <div key={`${flag.code}-${idx}`} className={`consistency-flag tone-${tone}`}>
              <div className="consistency-flag-header">
                <Icon name="alert" size={18} />
                <strong>{flag.label}</strong>
                <code className="flag-code">{flag.code}</code>
              </div>
              <p className="small">{flag.message}</p>
              {entries.length > 0 && (
                <dl className="consistency-values">
                  {entries.map(([fileName, value]) => (
                    <div key={fileName}>
                      <dt title={fileName}>{fileName}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>

      <p className="muted small">
        Cross-document consistency compares fields extracted by Bedrock from each uploaded document.
        Extraction may be imperfect — verify flagged mismatches against the original documents.
        This is a screening signal, not proof of fraud.
      </p>
    </div>
  );
}
