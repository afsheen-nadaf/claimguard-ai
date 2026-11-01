import { useCallback, useEffect, useState } from "react";

// Tiny hash router: keeps the back button working with zero dependencies.
function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "overview", params: {} };
  if (parts[0] === "new") return { name: "new", params: {} };
  if (parts[0] === "history") return { name: "history", params: {} };
  if (parts[0] === "analytics") return { name: "analytics", params: {} };
  if (parts[0] === "how-it-works") return { name: "how", params: {} };
  if (parts[0] === "results" && parts[1]) return { name: "results", params: { id: decodeURIComponent(parts[1]) } };
  return { name: "overview", params: {} };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path) => {
    window.location.hash = path;
  }, []);

  return [route, navigate];
}
