import { useEffect } from "react";
import Icon from "./Icon";
import { REGION } from "../api/config";

const NAV = [
  { id: "overview", href: "#/", label: "Overview", icon: "grid" },
  { id: "new", href: "#/new", label: "New claim", icon: "filePlus" },
  { id: "history", href: "#/history", label: "Claim history", icon: "history" },
  { id: "analytics", href: "#/analytics", label: "Analytics", icon: "chart" },
  { id: "how", href: "#/how-it-works", label: "How it works", icon: "help" },
];

export default function AppShell({ route, sessionCount, children }) {
  const activeId = route.name === "results" ? "history" : route.name;
  const pageTitle = route.name === "results"
    ? "Screening results"
    : NAV.find((item) => item.id === route.name)?.label || "Overview";
  useEffect(() => {
    document.title = `${pageTitle} · ClaimGuard AI`;
  }, [pageTitle]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="app-header">
        <div className="app-header-inner">
          <a className="brand" href="#/" aria-label="ClaimGuard AI home">
            <span className="brand-mark"><Icon name="shield" size={22} /></span>
            <span>
              <span className="brand-name">ClaimGuard AI</span>
              <span className="brand-sub">Claim screening</span>
            </span>
          </a>
          <nav className="nav" aria-label="Main navigation">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={`nav-item ${activeId === item.id ? "active" : ""}`}
                aria-current={activeId === item.id ? "page" : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.id === "history" && sessionCount > 0 && <span className="nav-count" aria-label={`${sessionCount} this session`}>{sessionCount}</span>}
              </a>
            ))}
          </nav>
          <div className="env-chip" title="The AWS region the screening API is deployed in">
            <span className="env-dot" aria-hidden="true" />
            AWS {REGION}
          </div>
        </div>
      </header>

      <div className="main">
        <main id="main" className="page" tabIndex={-1}>{children}</main>
        <footer className="app-footer">
          <span className="privacy-disclosure">
            <Icon name="lock" size={14} />
            Documents use private storage and short-lived upload links; they are not public.
          </span>
          <span>ClaimGuard AI screens indicators for human review; it does not determine fraud.</span>
        </footer>
      </div>
    </div>
  );
}
