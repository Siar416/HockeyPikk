import { useState } from "react";
import Today from "./pages/Today";
import Friends from "./pages/Friends";
import History from "./pages/History";
import Profile from "./pages/Profile";

const tabs = [
  {
    key: "today",
    label: "Today",
  },
  {
    key: "friends",
    label: "Friends",
  },
  {
    key: "history",
    label: "History",
  },
  {
    key: "profile",
    label: "Profile",
  },
];

export default function App() {
  const [active, setActive] = useState("today");

  const renderPage = () => {
    if (active === "today") return <Today />;
    if (active === "friends") return <Friends />;
    if (active === "history") return <History />;
    return <Profile />;
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="font-semibold">HockeyPikk</div>
          <div className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
            Draft
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-md pb-20 px-4 pt-4">{renderPage()}</main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-white">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={[
                  "py-3 text-sm",
                  isActive ? "text-neutral-900" : "text-neutral-400",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
