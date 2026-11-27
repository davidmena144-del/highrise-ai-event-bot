import React, { useEffect, useReducer } from "react";
import { UiController, WebStorage } from "./controller";
import { Dashboard } from "./screens/Dashboard";
import { EventSetup } from "./screens/EventSetup";
import { EnergyManagerScreen } from "./screens/EnergyManagerScreen";
import { SmartPlanner } from "./screens/SmartPlanner";
import { AutoPlayScreen } from "./screens/AutoPlayScreen";
import { RealTracker } from "./screens/RealTracker";
import { HistoryScreen } from "./screens/HistoryScreen";
import { FinalReportScreen } from "./screens/FinalReportScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

export type ScreenId =
  | "dashboard"
  | "setup"
  | "energy"
  | "planner"
  | "autoplay"
  | "tracker"
  | "history"
  | "report"
  | "settings";

const SCREENS: Array<{ id: ScreenId; label: string }> = [
  { id: "dashboard", label: "لوحة المتابعة" },
  { id: "setup", label: "إعداد الإيفنت" },
  { id: "energy", label: "إدارة الطاقة" },
  { id: "planner", label: "المخطط الذكي" },
  { id: "autoplay", label: "محاكاة اللعب التلقائي" },
  { id: "tracker", label: "متابعة الإيفنت الحقيقي" },
  { id: "history", label: "سجل الجلسات" },
  { id: "report", label: "التقرير النهائي" },
  { id: "settings", label: "الإعدادات" },
];

export const ControllerContext = React.createContext<UiController | null>(null);

export function makeController(): UiController {
  const backing = typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  return new UiController(new WebStorage(backing));
}

export function App({ controller }: { controller?: UiController }) {
  const [ctrl] = React.useState(() => controller ?? makeController());
  const [screen, setScreen] = React.useState<ScreenId>("dashboard");
  const [, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => ctrl.listen(() => bump()), [ctrl]);

  // Keep the document RTL/Arabic even when embedded outside index.html.
  useEffect(() => {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  }, []);

  const status = ctrl.autoPlayer.getStatus();
  const active = status === "running" || status === "paused";

  return (
    <ControllerContext.Provider value={ctrl}>
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-10 bg-slate-900/95 border-b border-slate-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-base font-bold text-white w-full sm:w-auto">بوت فعاليات هاي رايز الذكي</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <span className={`badge ${ctrl.mode === "sim" ? "bg-amber-600 text-white" : "bg-emerald-700 text-white"}`}>
              {ctrl.mode === "sim" ? "SIMULATION · محاكاة" : "إيفنت حقيقي (إدخال يدوي)"}
            </span>
            <button
              data-testid="stop-now"
              className="btn-danger text-base whitespace-nowrap px-4 py-2 shadow-lg shadow-red-900/50"
              disabled={!active}
              onClick={() => ctrl.stopNow()}
            >
              ⛔ إيقاف فوري
            </button>
            {typeof window !== "undefined" && window.location.protocol.startsWith("http") && (
              <button
                data-testid="logout"
                className="btn text-sm whitespace-nowrap bg-slate-700 text-slate-200"
                onClick={async () => {
                  await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
                  window.location.href = "/login";
                }}
              >
                خروج
              </button>
            )}
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-3 py-4">
          {screen === "dashboard" && <Dashboard />}
          {screen === "setup" && <EventSetup />}
          {screen === "energy" && <EnergyManagerScreen />}
          {screen === "planner" && <SmartPlanner />}
          {screen === "autoplay" && <AutoPlayScreen />}
          {screen === "tracker" && <RealTracker />}
          {screen === "history" && <HistoryScreen />}
          {screen === "report" && <FinalReportScreen />}
          {screen === "settings" && <SettingsScreen />}
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-700 overflow-x-auto">
          <div className="flex max-w-3xl mx-auto">
            {SCREENS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScreen(s.id)}
                className={`flex-1 whitespace-nowrap px-3 py-3 text-sm ${
                  screen === s.id ? "text-indigo-300 font-bold border-t-2 border-indigo-400" : "text-slate-400"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </ControllerContext.Provider>
  );
}
