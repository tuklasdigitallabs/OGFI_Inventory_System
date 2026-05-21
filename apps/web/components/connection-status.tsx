"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import { offlineQueueCount } from "@/lib/offline-db";
import {
  getLastOfflineRefresh,
  refreshOfflineData,
} from "@/lib/offline-refresh";

type ConnectionStatusProps = {
  variant: "banner" | "pills";
};

export function ConnectionStatus({ variant }: ConnectionStatusProps) {
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    async function refreshStatus() {
      setOnline(window.navigator.onLine);
      setPendingSync(await offlineQueueCount());
      setLastRefresh(getLastOfflineRefresh());
    }

    void refreshStatus();
    window.addEventListener("online", refreshStatus);
    window.addEventListener("offline", refreshStatus);
    window.addEventListener("focus", refreshStatus);
    window.addEventListener("storage", refreshStatus);
    window.addEventListener("ogfi:offline-queue-change", refreshStatus);
    window.addEventListener("ogfi:offline-refresh-complete", refreshStatus);
    const intervalId = window.setInterval(refreshStatus, 5000);

    return () => {
      window.removeEventListener("online", refreshStatus);
      window.removeEventListener("offline", refreshStatus);
      window.removeEventListener("focus", refreshStatus);
      window.removeEventListener("storage", refreshStatus);
      window.removeEventListener("ogfi:offline-queue-change", refreshStatus);
      window.removeEventListener(
        "ogfi:offline-refresh-complete",
        refreshStatus,
      );
      window.clearInterval(intervalId);
    };
  }, []);

  const runRefresh = useCallback(async () => {
    if (!window.navigator.onLine || refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    setRefreshing(true);

    try {
      const refreshedAt = await refreshOfflineData();
      setLastRefresh(refreshedAt ?? getLastOfflineRefresh());
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!online) {
      return;
    }

    void runRefresh();
    const intervalId = window.setInterval(runRefresh, 10 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [online, runRefresh]);

  if (variant === "banner") {
    if (online) {
      return null;
    }

    return (
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-[#8a5200] sm:px-6">
        <div className="flex items-center gap-2">
          <Icon name="WifiOff" size={18} />
          <span>
            Offline mode: cached pages are read-only except offline-enabled
            queues. Sync when the connection returns.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
      <span
        className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
          pendingSync > 0
            ? "border-orange-200 bg-orange-50 text-[#8a5200]"
            : "border-og-line bg-white text-og-gray"
        }`}
      >
        <Icon name="CloudUpload" size={18} />
        {pendingSync} pending sync
      </span>
      <span
        className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
          online
            ? "border-green-200 bg-green-50 text-og-green"
            : "border-red-200 bg-red-50 text-og-error"
        }`}
      >
        <Icon name={online ? "Wifi" : "WifiOff"} size={18} />
        {online ? "Online" : "Offline"}
      </span>
      <button
        className="hidden h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60 xl:inline-flex"
        disabled={!online || refreshing}
        type="button"
        onClick={runRefresh}
      >
        <Icon
          name="RefreshCw"
          size={18}
          className={refreshing ? "animate-spin" : ""}
        />
        {lastRefresh
          ? `Cached ${formatTime(lastRefresh)}`
          : "Refresh Offline Data"}
      </button>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
