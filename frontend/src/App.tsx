import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { DailyLog } from './pages/DailyLog';
import { Analytics as AnalyticsPage } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { getAllPeriods, getAllDailyLogs } from './db';
import { startReminderCheck, getNotificationPrefs } from './utils/notifications';
import { InstallPrompt } from './components/InstallPrompt';
import { ReloadPrompt } from './components/ReloadPrompt';

function App() {
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    checkData();
    const onFocus = () => checkData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Start daily check-in reminder notifications
  useEffect(() => {
    const prefs = getNotificationPrefs();
    if (!prefs.enabled) return;

    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const cleanup = startReminderCheck(() => {
      // Synchronously check localStorage cache for today's log
      try {
        const today = toLocal(new Date());
        const cached = localStorage.getItem('last_logged_date');
        return cached === today;
      } catch {
        return false;
      }
    });

    // Also do an async check and cache the result
    getAllDailyLogs().then((logs) => {
      const today = toLocal(new Date());
      if (logs.some((l) => l.date === today)) {
        localStorage.setItem('last_logged_date', today);
      }
    });

    return cleanup;
  }, []);

  const checkData = async () => {
    try {
      const periods = await getAllPeriods();
      setHasData(periods.length > 0);
    } catch (error) {
      setHasData(false);
    }
  };

  if (hasData === null) {
    return (
      <div className="app-shell">
        <div className="main">
          <div className="page">
            <div className="card">Loading your data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={hasData ? <Navigate to="/dashboard" /> : <Onboarding />}
        />
        <Route
          path="/dashboard"
          element={
            <Shell>
              <Dashboard />
            </Shell>
          }
        />
        <Route
          path="/history"
          element={
            <Shell>
              <History />
            </Shell>
          }
        />
        <Route
          path="/daily-log"
          element={
            <Shell>
              <DailyLog />
            </Shell>
          }
        />
        <Route
          path="/analytics"
          element={
            <Shell>
              <AnalyticsPage />
            </Shell>
          }
        />
        <Route
          path="/settings"
          element={
            <Shell>
              <Settings />
            </Shell>
          }
        />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="app-shell">
    <InstallPrompt />
    <ReloadPrompt />
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span>🌙 Selene</span>
          <span className="brand-badge">Health Companion</span>
        </div>
        <nav className="nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            Analytics
          </NavLink>
          <NavLink
            to="/daily-log"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            Log
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            History
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            ⚙️
          </NavLink>
        </nav>
      </div>
    </header>
    <main className="main">
      <div className="page">{children}</div>
    </main>
  </div>
);

export default App;
