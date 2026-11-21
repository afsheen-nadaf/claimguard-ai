import { useEffect, useState } from "react";

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (scrollTop / scrollHeight) * 100;
      setProgress(scrolled);
    };

    window.addEventListener("scroll", updateProgress);
    updateProgress();

    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-slate-900/80 backdrop-blur-sm z-50 shadow-lg">
      <div
        className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 transition-all duration-150 ease-out shadow-lg shadow-purple-500/50"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
