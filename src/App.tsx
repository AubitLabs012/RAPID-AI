import { useState } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { RapidDashboard } from './components/rapid/RapidDashboard';
import { useDashboardStore } from './store';

const LOGIN_STORAGE_KEY = 'maris_ai_logged_in';

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem(LOGIN_STORAGE_KEY) === 'true');
  const setActiveNav = useDashboardStore(state => state.setActiveNav);
  if (!authenticated) return <LoginPage onLogin={() => {
    localStorage.setItem(LOGIN_STORAGE_KEY, 'true');
    setActiveNav('Home');
    setAuthenticated(true);
  }} />;
  return <RapidDashboard onLogout={() => {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
    setActiveNav('Home');
    setAuthenticated(false);
  }} />;
}
