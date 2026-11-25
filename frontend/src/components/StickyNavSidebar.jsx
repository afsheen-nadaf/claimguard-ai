import { useEffect, useState } from "react";
import Icon from "./Icon";

export default function StickyNavSidebar({
  riskScore,
  flaggedChecks,
  passedChecks,
  skippedChecks = [],
}) {
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5, rootMargin: "-100px 0px -50% 0px" }
    );

    const sections = document.querySelectorAll("[data-section]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 120;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveSection(sectionId);
    }
  };

  const getRiskLevel = (score) => {
    if (score <= 30) return { label: "Low", color: "text-emerald-400", bgColor: "bg-emerald-500" };
    if (score <= 60) return { label: "Medium", color: "text-amber-400", bgColor: "bg-amber-500" };
    return { label: "High", color: "text-red-400", bgColor: "bg-red-500" };
  };

  const risk = getRiskLevel(riskScore);

  const sections = [
    { id: "section-overview", label: "Overview", icon: "eye" },
    { id: "section-policy", label: "Policy", icon: "clipboard" },
    { id: "section-duplicate", label: "Duplicate", icon: "copy" },
    { id: "section-outlier", label: "Outlier", icon: "sliders" },
    { id: "section-forensics", label: "Forensics", icon: "image" },
    { id: "section-evidence", label: "Evidence", icon: "search" },
    { id: "section-consistency", label: "Consistency", icon: "layers" },
    { id: "section-details", label: "Details", icon: "info" },
  ];

  return (
    <aside className="results-sidebar-scrollbar hidden lg:block w-80 sticky top-32 h-[calc(100vh-140px)] overflow-y-auto border-r border-purple-800/30 bg-[#16111f]/80 backdrop-blur-md px-6 py-8">
      {/* Verdict Section */}
      <div className="mb-8 p-6 bg-gradient-to-br from-[#1a1425] to-[#251d33] border border-purple-700/50 rounded-2xl text-center shadow-xl">
        <div className="text-[10px] font-bold tracking-[0.15em] text-purple-400 uppercase mb-4">
          Risk Verdict
        </div>
        <div className={`text-6xl font-extrabold mb-3 ${risk.color}`}>
          {riskScore}
        </div>
        <div className={`text-sm font-bold uppercase tracking-wider mb-5 ${risk.color}`}>
          {risk.label} Risk
        </div>
        <div className="h-2 bg-purple-950 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full ${risk.bgColor} transition-all duration-1000 ease-out rounded-full shadow-lg`}
            style={{ width: `${riskScore}%` }}
          />
        </div>
      </div>

      {/* Flagged Checks */}
      {flaggedChecks.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-amber-400 uppercase mb-3 px-1">
            <Icon name="alertTriangle" size={13} />
            Flagged ({flaggedChecks.length})
          </div>
          <ul className="space-y-1.5">
            {flaggedChecks.map((check) => (
              <li key={check.id}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-amber-400 bg-amber-950/20 hover:bg-amber-950/40 hover:text-amber-300 border border-amber-900/30 hover:border-amber-800/50 transition-all"
                  onClick={() => scrollToSection(`section-${check.id}`)}
                >
                  <Icon name="alert" size={16} />
                  <span className="truncate">{check.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Passed Checks */}
      {passedChecks.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-emerald-400 uppercase mb-3 px-1">
            <Icon name="checkCircle" size={13} />
            Passed ({passedChecks.length})
          </div>
          <ul className="space-y-1.5">
            {passedChecks.map((check) => (
              <li key={check.id}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 hover:text-emerald-300 border border-emerald-900/30 hover:border-emerald-800/50 transition-all"
                  onClick={() => scrollToSection(`section-${check.id}`)}
                >
                  <Icon name="check" size={16} />
                  <span className="truncate">{check.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skipped Checks */}
      {skippedChecks.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-purple-300 uppercase mb-3 px-1">
            <Icon name="info" size={13} />
            Skipped ({skippedChecks.length})
          </div>
          <ul className="space-y-1.5">
            {skippedChecks.map((check) => (
              <li key={check.id}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-purple-200 bg-purple-950/30 hover:bg-purple-900/40 hover:text-white border border-purple-800/40 hover:border-purple-700/60 transition-all"
                  onClick={() => scrollToSection(`section-${check.id}`)}
                >
                  <Icon name="info" size={16} />
                  <span className="truncate">{check.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-purple-800/30 my-7" />

      {/* Navigation Sections */}
      <div>
        <div className="text-[10px] font-bold tracking-[0.15em] text-purple-400 uppercase mb-3 px-1">
          Jump to Section
        </div>
        <ul className="space-y-1.5">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative ${
                  activeSection === section.id
                    ? "bg-purple-900/40 text-purple-200 border border-purple-700/50 shadow-lg shadow-purple-900/20 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-10 before:bg-purple-500 before:rounded-r-full"
                    : "text-purple-300 hover:bg-purple-950/30 hover:text-purple-200 border border-transparent hover:border-purple-800/30"
                }`}
                onClick={() => scrollToSection(section.id)}
              >
                <Icon name={section.icon} size={18} />
                <span className="truncate">{section.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}