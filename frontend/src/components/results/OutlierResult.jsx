import { formatINR, formatNumber } from "../../lib/format";
import { KeyValueList } from "../ui";
import RangeChart from "./RangeChart";

export default function OutlierResult({ result, claim }) {
  const m = result.metrics;
  // Prefer the amount we submitted; fall back to what the API echoed back.
  const amount = claim?.claimAmountINR ?? m.submittedAmount;

  return (
    <div className="space-y-6">
      <p className="text-lg font-semibold text-white">{result.label}</p>
      {result.message && <p className="text-purple-200">{result.message}</p>}
      {result.rawStatus && (
        <p className="text-sm text-purple-300">
          API status: <code className="px-2 py-1 bg-purple-950 rounded text-purple-200 border border-purple-800">{result.rawStatus}</code>
        </p>
      )}

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
          <div className="text-xs font-bold tracking-wider text-purple-400 uppercase mb-3">
            Additional details
          </div>
          <KeyValueList items={result.details} />
        </div>
      )}

      <p className="text-xs text-purple-400 leading-relaxed">
        An amount outlier is an anomaly indicator. Unusual amounts are often legitimate, and it is not proof of fraud.
      </p>
    </div>
  );
}
