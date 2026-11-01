import { formatINR, formatNumber } from "../../lib/format";
import { KeyValueList } from "../ui";
import RangeChart from "./RangeChart";

export default function OutlierResult({ result, claim }) {
  const m = result.metrics;
  // Prefer the amount we submitted; fall back to what the API echoed back.
  const amount = claim?.claimAmountINR ?? m.submittedAmount;

  return (
    <>
      <p className="result-headline">{result.label}</p>
      {result.message && <p>{result.message}</p>}
      {result.rawStatus && <p className="muted small">API status: <code>{result.rawStatus}</code></p>}

      <KeyValueList
        items={[
          { label: "Submitted amount", value: formatINR(amount) },
          { label: "Historical sample size", value: formatNumber(m.sampleSize, 0) },
          { label: "Statistical method", value: m.method },
          { label: "Median amount", value: formatINR(m.median) },
          { label: "Median absolute deviation", value: formatINR(m.mad) },
          { label: "Lower bound", value: formatINR(m.lowerBound) },
          { label: "Upper bound", value: formatINR(m.upperBound) },
          { label: "Robust Z-score", value: formatNumber(m.robustZ, 3) },
        ]}
      />

      <RangeChart amount={amount} lower={m.lowerBound} upper={m.upperBound} median={m.median} />

      {result.details.length > 0 && (
        <div>
          <div className="mini-label">Additional details</div>
          <KeyValueList items={result.details} />
        </div>
      )}

      <p className="muted small">
        An amount outlier is an anomaly indicator. Unusual amounts are often legitimate, and it is not proof of fraud.
      </p>
    </>
  );
}
