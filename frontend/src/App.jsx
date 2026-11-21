import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "./components/AppShell";
import ToastContainer from "./components/Toast";
import { useClaimDraft } from "./hooks/useClaimDraft";
import { useRoute } from "./hooks/useRoute";
import { useScreenings } from "./hooks/useScreenings";
import AnalyticsPage from "./pages/AnalyticsPage";
import HistoryPage from "./pages/HistoryPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import NewClaimPage from "./pages/NewClaimPage";
import OverviewPage from "./pages/OverviewPage";
import ResultsPage from "./pages/ResultsPage";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import SignInPage from "./auth/SignInPage";

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const auth = useAuth();
  if (auth.status === "loading") {
    return <div className="min-h-screen bg-[#0f0b14]" aria-busy="true" />;
  }
  if (auth.status !== "authenticated") return <SignInPage />;
  return <AuthenticatedApp auth={auth} />;
}

function AuthenticatedApp({ auth }) {
  const [route, navigate] = useRoute();
  const role = auth.session.user.role;
  // Both live above the router so in-progress work survives page changes.
  const draft = useClaimDraft();
  const {
    records,
    start,
    retry,
    loadMore,
    hasMore,
    isLoadingMore,
    loadClaim,
    isHistoryLoading,
  } = useScreenings(auth.session.user.id, role);
  const [loadingClaimId, setLoadingClaimId] = useState(null);
  const lookupInProgress = useRef(new Set());

  const isClaimantRouteBlocked =
    role === "claimant" && !["new", "history", "results"].includes(route.name);
  const isAdjusterRouteBlocked = role === "adjuster" && route.name === "new";

  useEffect(() => {
    if (isClaimantRouteBlocked) navigate("/new");
    else if (isAdjusterRouteBlocked) navigate("/");
  }, [isAdjusterRouteBlocked, isClaimantRouteBlocked, navigate]);

  const claimId = route.name === "results" ? route.params.id : null;
  const resultRecord = claimId
    ? records.find((record) => record.id === claimId)
    : null;

  useEffect(() => {
    if (
      !claimId ||
      resultRecord ||
      isHistoryLoading ||
      lookupInProgress.current.has(claimId)
    ) {
      return;
    }
    lookupInProgress.current.add(claimId);
    setLoadingClaimId(claimId);
    loadClaim(claimId)
      .catch((error) => {
        console.error("[App] Could not load claim results:", error);
        toast.error(`Could not load claim results: ${error.message}`);
      })
      .finally(() => setLoadingClaimId(null));
  }, [claimId, isHistoryLoading, loadClaim, resultRecord]);

  if (isClaimantRouteBlocked || isAdjusterRouteBlocked) {
    return <div className="min-h-screen bg-[#0f0b14]" aria-busy="true" />;
  }

  let page;
  switch (route.name) {
    case "new":
      page = (
        <NewClaimPage
          draft={draft}
          onScreeningReady={start}
          navigate={navigate}
        />
      );
      break;
    case "results":
      page = !resultRecord && (loadingClaimId === route.params.id || isHistoryLoading)
        ? <p className="text-purple-200" role="status">Loading claim results…</p>
        : (
          <ResultsPage
            record={resultRecord}
            onRetry={retry}
            navigate={navigate}
          />
        );
      break;
    case "history":
      page = (
        <HistoryPage
          records={records}
          navigate={navigate}
          role={role}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
        />
      );
      break;
    case "analytics":
      page = <AnalyticsPage records={records} navigate={navigate} />;
      break;
    case "how":
      page = <HowItWorksPage />;
      break;
    default:
      page = <OverviewPage records={records} navigate={navigate} />;
  }

  return (
    <>
      <AppShell
        route={route}
        sessionCount={records.length}
        role={role}
        account={auth.session.user}
        onSignOut={auth.signOut}
      >
        {page}
      </AppShell>
      <ToastContainer />
    </>
  );
}
