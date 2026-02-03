import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from 'react-router-dom';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { getAllPeriods } from './db';

function App() {
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    checkData();
    const onFocus = () => checkData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
      </Routes>
    </BrowserRouter>
  );
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span>🌙 Elaris</span>
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
            to="/history"
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            History
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
