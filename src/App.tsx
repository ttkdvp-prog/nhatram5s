import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { LoginView } from './components/LoginView';
import { AUTH_EXPIRED_EVENT, Session, getSession, saveSession, logout } from './services/auth';

// Xóa bộ đệm dữ liệu cục bộ khi đổi người dùng để không lộ dữ liệu của phạm vi khác.
const clearCachedData = () => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('nhatram5s_') && k !== 'nhatram5s_appscript_url')
      .forEach(k => localStorage.removeItem(k));
  } catch {
    /* bỏ qua */
  }
};

export function App() {
  const [session, setSession] = useState<Session | null>(getSession());

  useEffect(() => {
    const onExpired = () => {
      clearCachedData();
      setSession(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  if (!session) {
    return (
      <LoginView
        onLoggedIn={s => {
          clearCachedData();
          saveSession(s);
          setSession(s);
        }}
      />
    );
  }

  return (
    <Layout
      session={session}
      onSessionChange={s => {
        saveSession(s);
        setSession(s);
      }}
      onLogout={async () => {
        await logout();
        clearCachedData();
        setSession(null);
      }}
    />
  );
}

export default App;
