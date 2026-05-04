'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '@/lib/icons';

type AuthGateProps = {
  children: React.ReactNode;
};

type AuthenticatedUser = {
  email: string;
  fullName: string;
  role: {
    code: string;
    name: string;
  };
};

type LoginResponse = {
  accessToken: string;
  user: AuthenticatedUser;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'ogfi.accessToken';

export function AuthGate({ children }: AuthGateProps) {
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    void loadCurrentUser(storedToken);
  }, []);

  async function loadCurrentUser(accessToken: string) {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Session expired.');
      }

      const currentUser = (await response.json()) as AuthenticatedUser;
      setToken(accessToken);
      setUser(currentUser);
    } catch {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid username or password.');
      }

      const result = (await response.json()) as LoginResponse;
      window.localStorage.setItem(TOKEN_KEY, result.accessToken);
      setToken(result.accessToken);
      setUser(result.user);
    } catch (loginError) {
      setToken(null);
      setUser(null);
      setError(loginError instanceof Error ? loginError.message : 'Unable to log in.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setPassword('');
  }

  if (loading && !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] px-4 text-og-dark">
        <div className="flex items-center gap-3 text-sm font-semibold text-og-gray">
          <Icon name="RefreshCw" size={20} className="animate-spin text-og-green" />
          Loading session
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] px-4 py-8 text-og-dark">
        <form className="w-full max-w-sm rounded-md border border-og-line bg-white p-5 shadow-sm" onSubmit={login}>
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-og-green font-poppins text-lg font-bold text-white">
              OG
            </span>
            <div>
              <h1 className="font-poppins text-xl font-semibold">OGFI Inventory</h1>
              <p className="text-sm text-og-gray">Sign in to continue</p>
            </div>
          </div>

          <label className="mb-3 block text-sm font-semibold">
            Username or email
            <input
              className="mt-1 h-11 w-full rounded-md border border-og-line px-3 text-sm outline-none focus:border-og-green"
              onChange={(event) => setIdentifier(event.target.value)}
              value={identifier}
            />
          </label>

          <label className="block text-sm font-semibold">
            Password
            <input
              className="mt-1 h-11 w-full rounded-md border border-og-line px-3 text-sm outline-none focus:border-og-green"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}

          <button
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            <Icon name="KeyRound" size={18} />
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-30 hidden items-center gap-2 rounded-md border border-og-line bg-white px-3 py-2 text-xs font-semibold text-og-gray shadow-sm lg:flex">
        <Icon name="ShieldCheck" size={16} className="text-og-green" />
        <span>{user.fullName}</span>
        <span className="text-og-line">|</span>
        <span>{user.role.name}</span>
        <button className="text-og-green" onClick={logout} type="button">
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
