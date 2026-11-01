import AppShell from "./components/AppShell";
import { useClaimDraft } from "./hooks/useClaimDraft";
import { useRoute } from "./hooks/useRoute";
import { useScreenings } from "./hooks/useScreenings";
import AnalyticsPage from "./pages/AnalyticsPage";
import HistoryPage from "./pages/HistoryPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import NewClaimPage from "./pages/NewClaimPage";
import OverviewPage from "./pages/OverviewPage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  const [route, navigate] = useRoute();
  // Both live above the router so in-progress work survives page changes.
  const draft = useClaimDraft();
  const screenings = useScreenings();

  let page;
  switch (route.name) {
    case "new":
      page = <NewClaimPage draft={draft} onScreeningReady={screenings.start} navigate={navigate} />;
      break;
    case "results":
      page = (
        <ResultsPage
          record={screenings.records.find((r) => r.id === route.params.id)}
          onRetry={screenings.retry}
          navigate={navigate}
        />
      );
      break;
    case "history":
      page = <HistoryPage records={screenings.records} navigate={navigate} />;
      break;
    case "analytics":
      page = <AnalyticsPage records={screenings.records} navigate={navigate} />;
      break;
    case "how":
      page = <HowItWorksPage />;
      break;
    default:
      page = <OverviewPage records={screenings.records} navigate={navigate} />;
  }

  return (
    <AppShell route={route} sessionCount={screenings.records.length}>
      {page}
    </AppShell>
  );
}
