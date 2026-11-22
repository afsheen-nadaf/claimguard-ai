import { useEffect } from "react";
import Icon from "./Icon";
import { REGION } from "../api/config";

const ADJUSTER_NAV = [
  { id: "overview", href: "#/", label: "OVERVIEW", icon: "grid" },
  { id: "history", href: "#/history", label: "CLAIM HISTORY", icon: "history" },
  { id: "analytics", href: "#/analytics", label: "ANALYTICS", icon: "chart" },
];

const CLAIMANT_NAV = [
  { id: "new", href: "#/new", label: "SUBMIT CLAIM", icon: "filePlus" },
  { id: "history", href: "#/history", label: "MY CLAIMS", icon: "history" },
  { id: "how", href: "#/how-it-works", label: "HOW IT WORKS", icon: "help" },
];

export default function AppShell({
  route,
  sessionCount,
  role,
  account,
  onSignOut,
  children,
}) {
  const nav = role === "adjuster" ? ADJUSTER_NAV : CLAIMANT_NAV;
  const activeId = route.name === "results" ? "history" : route.name;
  const pageTitle = route.name === "results"
    ? "Screening results"
    : nav.find((item) => item.id === route.name)?.label || "ClaimGuard AI";
  useEffect(() => {
    document.title = `${pageTitle} · ClaimGuard AI`;
  }, [pageTitle]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0b14]">
      <a
        className="absolute left-[-999px] top-2 z-50 bg-purple-900 text-white px-4 py-2 rounded-lg focus:left-2"
        href="#main"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 backdrop-blur-xl border-b border-purple-800/10">
        <div className="w-full max-w-[1920px] h-[74px] mx-auto px-9 flex items-center gap-6">
          {/* Brand */}
          <a
            className="flex items-center py-1 text-white rounded-lg flex-shrink-0 hover:opacity-80 transition-opacity"
            href="#/"
            aria-label="ClaimGuard AI home"
          >
            <span className="font-extrabold text-[17px] tracking-tight">ClaimGuard AI</span>
          </a>

          {/* Navigation */}
          <nav className="flex items-center justify-center gap-2.5 flex-1 min-w-0" aria-label="Main navigation">
            {nav.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all border-2 ${
                  activeId === item.id
                    ? "bg-purple-900/40 text-white shadow-lg border-purple-700/60 shadow-purple-900/30"
                    : "bg-purple-950/20 border-purple-800/30 text-purple-300 hover:bg-purple-900/25 hover:border-purple-700/50 hover:text-white"
                }`}
                aria-current={activeId === item.id ? "page" : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.id === "history" && sessionCount > 0 && (
                  <span
                    className="text-[10px] font-bold bg-purple-700/50 text-purple-100 rounded-full px-2 py-0.5 border border-purple-600/50"
                    aria-label={`${sessionCount} this session`}
                  >
                    {sessionCount}
                  </span>
                )}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 flex-shrink-0">
            {REGION && (
              <div
                className="inline-flex items-center gap-2 text-[11.5px] font-semibold text-purple-400 bg-[#251d33] border border-purple-800/30 rounded-full px-3 py-1.5 whitespace-nowrap"
                title="The AWS region the screening API is deployed in"
              >
                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_0_3px_rgba(168,85,247,0.2)]" aria-hidden="true" />
                AWS {REGION}
              </div>
            )}
            <div className="flex items-center gap-2 text-right">
              <div className="block min-w-0 max-w-[140px]">
                <p className="truncate text-[10px] font-semibold text-white" title={account?.email}>
                  {account?.email || "Signed in"}
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-purple-300">
                  {role}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-purple-700/40 px-3 py-2 text-xs font-semibold text-purple-100 transition-colors hover:bg-purple-900/40"
                onClick={onSignOut}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col flex-1">
        <main id="main" className="w-full max-w-[1920px] mx-auto px-9 py-9 flex-1 outline-none" tabIndex={-1}>
          {children}
        </main>

        <footer className="flex justify-center items-center flex-wrap gap-2 md:gap-6 w-full max-w-[1920px] mx-auto px-9 py-5 border-t border-purple-800/20 text-purple-300 text-[11.5px]">
          <span className="inline-flex items-center gap-2">
            <Icon name="lock" size={14} className="text-purple-400 flex-shrink-0" />
            Documents use private storage and short-lived upload links; they are not public.
          </span>
          <span>ClaimGuard AI screens indicators for human review; it does not determine fraud.</span>
        </footer>
      </div>
    </div>
  );
}
