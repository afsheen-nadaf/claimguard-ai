import Icon from "./Icon";

const STEPS = ["Claim details", "Documents", "Review & submit", "Screening results"];

export default function Stepper({ current, onStepClick }) {
  return (
    <ol className="stepper" aria-label="Claim progress">
      {STEPS.map((label, i) => {
        const number = i + 1;
        const state = number === current ? "current" : number < current ? "complete" : "upcoming";
        const clickable = onStepClick && number < current && current < 4;
        const inner = (
          <>
            <span className="step-dot">{state === "complete" ? <Icon name="check" size={15} /> : number}</span>
            <span className="step-label">{label}</span>
          </>
        );
        return (
          <li key={label} className={`step step-${state}`} aria-current={state === "current" ? "step" : undefined}>
            {clickable ? (
              <button type="button" className="step-button" onClick={() => onStepClick(number)}>{inner}</button>
            ) : (
              <div className="step-button static">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
