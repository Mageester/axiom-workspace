import { useState } from "react";
import type { NavPage } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const PAGE_TITLES: Record<Exclude<NavPage, "dashboard">, string> = {
  repos: "Repos",
  sessions: "Sessions",
  locks: "Locks",
  activity: "Activity",
  settings: "Settings",
};

function App() {
  const [activeNav, setActiveNav] = useState<NavPage>("dashboard");

  function renderPage() {
    if (activeNav === "dashboard") {
      return <Dashboard />;
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
