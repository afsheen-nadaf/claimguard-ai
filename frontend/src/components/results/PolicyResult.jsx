import Icon from "../Icon";
import { KeyValueList } from "../ui";

export default function PolicyResult({ result }) {
  return (
    <>
      <p className="result-headline">{result.label}</p>
      {result.message && <p>{result.message}</p>}
      {result.rawStatus && <p className="muted small">API status: <code>{result.rawStatus}</code></p>}

      {result.flags.length > 0 ? (
        <div>
          <div className="mini-label">Flags returned ({result.flags.length})</div>
          <ul className="flag-list">
            {result.flags.map((flag, i) => (
              <li key={i}>
                <Icon name="alert" size={16} />
                <span>
                  {flag.text}
                  {flag.code && <code>{flag.code}</code>}
                  {flag.severity && <em>{flag.severity}</em>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        result.state === "pass" && <p className="muted small">The API returned no flags.</p>
      )}

      {result.details.length > 0 && (
        <div>
          <div className="mini-label">Additional details</div>
          <KeyValueList items={result.details} />
        </div>
      )}
    </>
  );
}
