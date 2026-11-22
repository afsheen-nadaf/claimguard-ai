import Icon from "./Icon";

const STEPS = ["Claim details", "Evidence photos", "Review & submit"];

export default function Stepper({ current, onStepClick }) {
  return (
    <ol className="grid grid-cols-3 mb-10 max-w-[820px]" aria-label="Claim progress">
      {STEPS.map((label, i) => {
        const number = i + 1;
        const state = number === current ? "current" : number < current ? "complete" : "upcoming";
        const clickable = onStepClick && number < current;

        const inner = (
          <>
            <span
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                state === "current"
                  ? "bg-purple-600 border-purple-600 text-white shadow-[0_0_0_4px_rgba(168,85,247,0.2)]"
                  : state === "complete"
                  ? "bg-[#1f1630] border-purple-600 text-purple-300"
                  : "bg-[#1a1425] border-purple-800/30 text-purple-500"
              }`}
            >
              {state === "complete" ? <Icon name="check" size={15} /> : number}
            </span>
            <span
              className={`text-[12.5px] font-medium text-center ${
                state === "current" || state === "complete" ? "text-white" : "text-purple-400"
              }`}
            >
              {label}
            </span>
          </>
        );

        return (
          <li
            key={label}
            className="relative flex justify-center before:content-[''] before:absolute before:top-5 before:right-1/2 before:w-full before:h-0.5 before:z-0 first:before:hidden"
            style={{
              "--tw-before-bg":
                state === "complete" || (state === "current" && i > 0)
                  ? "rgb(168 85 247)"
                  : "rgb(94 60 132)",
            }}
            aria-current={state === "current" ? "step" : undefined}
          >
            <style>{`
              li::before {
                background: var(--tw-before-bg);
              }
            `}</style>
            {clickable ? (
              <button
                type="button"
                className="relative z-10 flex flex-col items-center gap-2 p-1 rounded-lg hover:opacity-80 transition-opacity"
                onClick={() => onStepClick(number)}
              >
                {inner}
              </button>
            ) : (
              <div className="relative z-10 flex flex-col items-center gap-2 p-1">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}