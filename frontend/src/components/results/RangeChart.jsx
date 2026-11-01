import { formatINR } from "../../lib/format";

// Linear scale chart: reference band [lower, upper], optional median tick, and
// the submitted amount. Positions are computed directly from the returned
// numbers over a domain that always contains all of them, so the picture is
// faithful to the API values.
export default function RangeChart({ amount, lower, upper, median }) {
  if (amount === null || lower === null || upper === null || upper < lower) return null;

  const points = [amount, lower, upper, ...(median !== null ? [median] : [])];
  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  const span = rawMax - rawMin || Math.max(Math.abs(rawMax), 1);
  const min = rawMin - span * 0.12;
  const max = rawMax + span * 0.12;
  const pos = (v) => ((v - min) / (max - min)) * 100;

  const relation = amount < lower ? "below" : amount > upper ? "above" : "within";
  const relationText = {
    below: "below the returned lower bound",
    above: "above the returned upper bound",
    within: "within the returned bounds",
  }[relation];

  const markerLeft = pos(amount);
  const labelLeft = Math.min(88, Math.max(12, markerLeft));

  return (
    <figure className="range-chart">
      <figcaption className="mini-label">
        Submitted amount vs. historical reference range
      </figcaption>
      <div
        className="range-plot"
        role="img"
        aria-label={`Submitted amount ${formatINR(amount)} is ${relationText}: ${formatINR(lower)} to ${formatINR(upper)}.`}
      >
        <div className="range-marker-label" style={{ left: `${labelLeft}%` }}>
          <span className={`marker-pill marker-${relation}`}>{formatINR(amount)}</span>
        </div>
        <div className="range-track">
          <div className="range-band" style={{ left: `${pos(lower)}%`, width: `${pos(upper) - pos(lower)}%` }} />
          {median !== null && <div className="range-median" style={{ left: `${pos(median)}%` }} />}
          <div className={`range-marker marker-${relation}`} style={{ left: `${markerLeft}%` }} />
        </div>
        <div className="range-ends" aria-hidden="true">
          <span>{formatINR(rawMin)}</span>
          <span>{formatINR(rawMax)}</span>
        </div>
      </div>
      <ul className="range-legend">
        <li><span className="swatch swatch-band" />Reference range {formatINR(lower)} to {formatINR(upper)}</li>
        {median !== null && <li><span className="swatch swatch-median" />Median {formatINR(median)}</li>}
        <li><span className={`swatch swatch-${relation}`} />Submitted amount is {relationText}</li>
      </ul>
    </figure>
  );
}
