import { useEffect, useState } from "react";
import Icon from "./Icon";
import { REGION } from "../api/config";

const NAV = [
  { id: "overview", href: "#/", label: "Overview", icon: "grid", crumb: "Overview" },
  { id: "new", href: "#/new", label: "New Claim", icon: "filePlus", crumb: "New claim" },
  { id: "history", href: "#/history", label: "Claim History", icon: "history", crumb: "Claim history" },
  { id: "analytics", href: "#/analytics", label: "Analytics", icon: "chart", crumb: "Analytics" },
  { id: "how", href: "#/how-it-works", label: "How It Works", icon: "help", crumb: "How it works" },
];

function crumbFor(routeName) {
  if (routeName === "results") return ["Claims", "Screening results"];
  const item = NAV.find((n) => n.id === routeName);
  return [item?.crumb || "Overview"];
}

export default function AppShell({ route, sessionCount, children }) {
  const [open, setOpen] = useState(false);
  const activeId = route.name === "results" ? "history" : route.name;
  const crumbs = crumbFor(route.name);

  // Close the drawer on navigation and on Escape.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [route.name, route.params.id]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Sidebar">
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
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === "history" && sessionCount > 0 && <span className="nav-count" aria-label={`${sessionCount} this session`}>{sessionCount}</span>}
            </a>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="side-note">
            <Icon name="lock" size={17} />
            <p>Documents go to private storage through short-lived upload links. Nothing is made public.</p>
          </div>
        </div>
      </aside>
      {open && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-button menu-button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
              <Icon name="menu" size={22} />
            </button>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <span>ClaimGuard AI</span>
              {crumbs.map((c, i) => (
                <span key={c} className="crumb" aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                  <span className="crumb-sep" aria-hidden="true">/</span>{c}
                </span>
              ))}
            </nav>
          </div>
          <div className="env-chip" title="The AWS region the screening API is deployed in">
            <span className="env-dot" aria-hidden="true" />
            AWS {REGION}
          </div>
        </div>
        <main id="main" className="page" tabIndex={-1}>{children}</main>
        <footer className="app-footer">
          ClaimGuard AI screens for indicators to support human review. It does not determine fraud.
        </footer>
      </div>
    </div>
  );
}
