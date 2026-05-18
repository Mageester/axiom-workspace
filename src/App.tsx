import { useState } from "react";
import type { NavPage } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { useRepos } from "./hooks/useRepos";

const PAGE_TITLES: Record<Exclude<NavPage, "dashboard">, string> = {
  repos: "Repos",
  sessions: "Sessions",
  locks: "Locks",
  activity: "Activity",
  settings: "Settings",
};

function App() {
  const [activeNav, setActiveNav] = useState<NavPage>("dashboard");
  const {
    repos,
    loading,
    refreshingPaths,
    addRepo,
    removeRepo,
    refreshRepo,
    refreshAll,
  } = useRepos();

  function renderPage() {
    if (activeNav === "dashboard") {
      return (
        <Dashboard
          repos={repos}
          loading={loading}
          refreshingPaths={refreshingPaths}
          onRefreshAll={refreshAll}
          onRefreshRepo={refreshRepo}
          onAddRepo={addRepo}
          onRemoveRepo={removeRepo}
        />
      );
    }
    return (
      <PlaceholderPage
        title={PAGE_TITLES[activeNav]}
        description={`${PAGE_TITLES[activeNav]} management coming soon.`}
      />
    );
  }

  return (
    <div className="flex h-screen bg-surface-0">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      {renderPage()}
    </div>
  );
}

export default App;
