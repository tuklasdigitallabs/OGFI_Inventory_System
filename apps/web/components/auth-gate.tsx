"use client";

import {
  cloneElement,
  createElement,
  FormEvent,
  isValidElement,
  type ReactElement,
  useEffect,
  useState,
} from "react";
import { Icon } from "@/lib/icons";
import {
  ApiClient,
  API_URL,
  TOKEN_KEY,
  type AuthenticatedUser,
  type OfflinePinStatus,
} from "@/lib/api-client";
import { clearOfflineData } from "@/lib/offline-db";
import {
  clearOfflinePin,
  hasOfflinePin,
  isOfflineSessionExpired,
  isOfflineUnlocked,
  lockOfflineSession,
  offlinePinMatchesPolicy,
  setupOfflinePin,
  touchOfflineSession,
  unlockOfflinePin,
} from "@/lib/offline-crypto";

type AuthGateProps = {
  children: React.ReactNode;
};

type LoginResponse = {
  accessToken: string;
  user: AuthenticatedUser;
};

type AuthGateChildProps = {
  currentUser?: AuthenticatedUser;
  onLogout?: () => void;
};

export function AuthGate({ children }: AuthGateProps) {
  const [captchaKey, setCaptchaKey] = useState(0);
  const [identifier, setIdentifier] = useState("admin");
  const [offlinePin, setOfflinePin] = useState("");
  const [offlinePinMode, setOfflinePinMode] = useState<
    "setup" | "unlock" | null
  >(null);
  const [offlinePinStatus, setOfflinePinStatus] =
    useState<OfflinePinStatus | null>(null);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void import("altcha");

    const storedToken = window.localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    if (!navigator.onLine && hasOfflinePin() && !isOfflineUnlocked()) {
      setToken(storedToken);
      setOfflinePinMode("unlock");
      setLoading(false);
      return;
    }

    void loadCurrentUser(storedToken);
  }, []);

  useEffect(() => {
    function touchSession() {
      touchOfflineSession();
    }

    function unlockOfflineStorage() {
      if (!navigator.onLine && hasOfflinePin() && !isOfflineUnlocked()) {
        setOfflinePinMode("unlock");
      }
    }

    window.addEventListener("click", touchSession);
    window.addEventListener("keydown", touchSession);
    window.addEventListener("focus", touchSession);
    window.addEventListener(
      "ogfi:offline-unlock-required",
      unlockOfflineStorage,
    );

    const intervalId = window.setInterval(() => {
      if (
        !navigator.onLine &&
        user &&
        hasOfflinePin() &&
        isOfflineSessionExpired()
      ) {
        lockOfflineSession();
        setOfflinePinMode("unlock");
      }
    }, 30000);

    return () => {
      window.removeEventListener("click", touchSession);
      window.removeEventListener("keydown", touchSession);
      window.removeEventListener("focus", touchSession);
      window.removeEventListener(
        "ogfi:offline-unlock-required",
        unlockOfflineStorage,
      );
      window.clearInterval(intervalId);
    };
  }, [user]);

  async function loadCurrentUser(accessToken: string) {
    try {
      const client = new ApiClient(accessToken);
      const [currentUser, pinStatus] = await Promise.all([
        client.currentUser(),
        client.offlinePinStatus().catch(() => null),
      ]);
      setToken(accessToken);
      setUser(currentUser);
      setOfflinePinStatus(pinStatus);
      setOfflinePinMode(navigator.onLine ? null : offlinePinModeFor(pinStatus));
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
      const altcha = String(
        new FormData(event.currentTarget).get("altcha") ?? "",
      );

      if (!altcha) {
        throw new Error("Complete the CAPTCHA before signing in.");
      }

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ altcha, identifier, password }),
      });

      if (!response.ok) {
        throw new Error(await loginErrorMessage(response));
      }

      const result = (await response.json()) as LoginResponse;
      const pinStatus = await new ApiClient(result.accessToken)
        .offlinePinStatus()
        .catch(() => null);
      window.localStorage.setItem(TOKEN_KEY, result.accessToken);
      setToken(result.accessToken);
      setUser(result.user);
      setCurrentPassword(result.user.mustChangePassword ? password : "");
      setPassword("");
      setOfflinePinStatus(pinStatus);
      setOfflinePinMode(null);
    } catch (loginError) {
      setToken(null);
      setUser(null);
      setCaptchaKey((key) => key + 1);
      setError(
        loginError instanceof Error ? loginError.message : "Unable to log in.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    lockOfflineSession();
    await clearOfflineData();
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setOfflinePin("");
    setOfflinePinStatus(null);
    setOfflinePinMode(null);
    setPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!token) {
        throw new Error("Sign in before changing password.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New password confirmation does not match.");
      }

      const updatedUser = await new ApiClient(token).changePassword(
        currentPassword,
        newPassword,
      );
      setUser(updatedUser);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setOfflinePinMode(offlinePinModeFor(offlinePinStatus));
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "Unable to change password.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitOfflinePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      if (offlinePinMode === "setup") {
        if (!token || !user) {
          throw new Error("Sign in before registering offline PIN.");
        }

        if (!offlinePinStatus?.configured) {
          throw new Error("Offline PIN is not configured by admin yet.");
        }

        const verified = await new ApiClient(token).verifyOfflinePin(
          offlinePin,
        );
        await setupOfflinePin(user.id, offlinePin, verified.updatedAt);
        await clearOfflineData();
        setOfflinePinMode(null);
      } else {
        await unlockOfflinePin(offlinePin);

        if (token && !user) {
          await loadCurrentUser(token);
        }

        setOfflinePinMode(null);
      }

      setOfflinePin("");
    } catch (pinError) {
      setError(
        pinError instanceof Error
          ? pinError.message
          : "Unable to unlock offline storage.",
      );
    }
  }

  async function resetThisBrowserOfflineData() {
    await clearOfflineData();
    clearOfflinePin();
    setError(null);
    setOfflinePin("");
    setOfflinePinMode(null);

    if (token) {
      setLoading(true);
      await loadCurrentUser(token);
    }
  }

  if (loading && !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] px-4 text-og-dark">
        <div className="flex items-center gap-3 text-sm font-semibold text-og-gray">
          <Icon
            name="RefreshCw"
            size={20}
            className="animate-spin text-og-green"
          />
          Loading session
        </div>
      </div>
    );
  }

  if (token && user?.mustChangePassword) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] px-4 py-8 text-og-dark">
        <form
          className="w-full max-w-sm rounded-md border border-og-line bg-white p-5 shadow-sm"
          onSubmit={submitPasswordChange}
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-og-green font-poppins text-lg font-bold text-white">
              OG
            </span>
            <div>
              <h1 className="font-poppins text-xl font-semibold">
                Change Password
              </h1>
              <p className="text-sm text-og-gray">
                Set a new password to continue.
              </p>
            </div>
          </div>

          <label className="mb-3 block text-sm font-semibold">
            Current password
            <input
              className="mt-1 h-11 w-full rounded-md border border-og-line px-3 text-sm outline-none focus:border-og-green"
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </label>

          <label className="mb-3 block text-sm font-semibold">
            New password
            <input
              className="mt-1 h-11 w-full rounded-md border border-og-line px-3 text-sm outline-none focus:border-og-green"
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </label>

          <label className="block text-sm font-semibold">
            Confirm new password
            <input
              className="mt-1 h-11 w-full rounded-md border border-og-line px-3 text-sm outline-none focus:border-og-green"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          </label>

          {error ? (
            <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
          ) : null}

          <button
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            <Icon name="KeyRound" size={18} />
            Change password
          </button>
        </form>
      </div>
    );
  }

  if (offlinePinMode) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] px-4 py-8 text-og-dark">
        <form
          className="w-full max-w-sm rounded-md border border-og-line bg-white p-5 shadow-sm"
          onSubmit={submitOfflinePin}
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-og-green font-poppins text-lg font-bold text-white">
              OG
            </span>
            <div>
              <h1 className="font-poppins text-xl font-semibold">
                {offlinePinMode === "setup"
                  ? "Enter Offline PIN"
                  : "Unlock Offline Data"}
              </h1>
              <p className="text-sm text-og-gray">
                Offline data is encrypted on this browser.
              </p>
            </div>
          </div>

          <label className="block text-sm font-semibold">
            Offline PIN
            <input
              className="mt-1 h-11 w-full rounded-md border border-og-line px-3 text-sm outline-none focus:border-og-green"
              minLength={6}
              onChange={(event) => setOfflinePin(event.target.value)}
              type="password"
              value={offlinePin}
            />
          </label>

          {error ? (
            <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
          ) : null}

          <button
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
          >
            <Icon name="LockKeyhole" size={18} />
            {offlinePinMode === "setup" ? "Register This Browser" : "Unlock"}
          </button>

          {offlinePinMode === "unlock" ? (
            <button
              className="mt-3 h-10 w-full rounded-md border border-og-line px-4 text-sm font-semibold text-og-gray"
              type="button"
              onClick={resetThisBrowserOfflineData}
            >
              Reset this browser offline data
            </button>
          ) : null}
        </form>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] px-4 py-8 text-og-dark">
        <form
          className="w-full max-w-sm rounded-md border border-og-line bg-white p-5 shadow-sm"
          onSubmit={login}
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-og-green font-poppins text-lg font-bold text-white">
              OG
            </span>
            <div>
              <h1 className="font-poppins text-xl font-semibold">
                OGFI Inventory
              </h1>
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

          {error ? (
            <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
          ) : null}

          <div className="mt-4">
            {createElement("altcha-widget", {
              challenge: `${API_URL}/auth/altcha-challenge`,
              hidefooter: "true",
              hidelogo: "true",
              key: captchaKey,
              name: "altcha",
            })}
          </div>

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
      {isValidElement(children)
        ? cloneElement(children as ReactElement<AuthGateChildProps>, {
            currentUser: user,
            onLogout: logout,
          })
        : children}
    </>
  );
}

async function loginErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }

    return body.message ?? "Invalid username or password.";
  } catch {
    return "Invalid username or password.";
  }
}

function offlinePinModeFor(
  pinStatus: OfflinePinStatus | null,
): "setup" | "unlock" | null {
  if (!pinStatus?.configured) {
    return null;
  }

  if (!hasOfflinePin() || !offlinePinMatchesPolicy(pinStatus.updatedAt)) {
    return "setup";
  }

  if (!isOfflineUnlocked()) {
    return "unlock";
  }

  return null;
}
