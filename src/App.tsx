import type { Session } from '@supabase/supabase-js';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { useEffect, useState } from 'react';
import { getBrowserClient, getMyUser, type User } from './lib/supabase';

const supabase = getBrowserClient();
const SESSION_TIMEOUT_MS = 5000;

async function resolveUser(session: Session | null): Promise<User | null> {
  if (!session) return null;
  try {
    const user = await getMyUser();
    console.log('[Auth] Resolved user:', user);
    return user;
  } catch (err) {
    console.error('[Auth] Failed to resolve user:', err);
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let latestProfileRequest = 0;

    const refreshUser = async (nextSession: Session | null) => {
      const requestId = latestProfileRequest + 1;
      latestProfileRequest = requestId;
      const nextUser = await resolveUser(nextSession);

      if (cancelled || requestId !== latestProfileRequest) {
        return;
      }

      setUser(nextUser);
    };

    const restoreSession = async () => {
      try {
        const {
          data: { session: restoredSession },
        } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          'Restoring your session took too long.',
        );

        if (cancelled) {
          return;
        }

        setSession(restoredSession);
        setLoading(false);
        void refreshUser(restoredSession);
      } catch (error) {
        console.error(error);

        if (cancelled) {
          return;
        }

        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (cancelled) {
          return;
        }

        setSession(nextSession);

        if (!nextSession) {
          latestProfileRequest += 1;
          setUser(null);
          return;
        }

        void refreshUser(nextSession);
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="panel app-loading__panel">
          <div className="app-loading__orb" aria-hidden="true" />
          <h2>Restoring your command deck</h2>
          <p>Loading your Dragon Nest session and syncing the latest dashboard state.</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={!session ? <LandingPage /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/dashboard"
          element={
            session
              ? <Dashboard user={user} />
              : <Navigate to="/" />
          }
        />
        <Route
          path="/admin"
          element={
            session && user?.is_admin
              ? <AdminDashboard user={user} />
              : session
                ? <Dashboard user={user} />   // non-admin users get the regular dashboard
                : <Navigate to="/" />
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
