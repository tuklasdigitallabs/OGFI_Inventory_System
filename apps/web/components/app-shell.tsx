"use client";

import Link from "next/link";
import { ConnectionStatus } from "./connection-status";
import type { AuthenticatedUser } from "@/lib/api-client";
import { Icon } from "@/lib/icons";
import { canAccessNavigationItem, navigation } from "@/lib/screens";

type AppShellProps = {
  children: React.ReactNode;
  currentUser?: AuthenticatedUser;
  onLogout?: () => void;
};

export function AppShell({ children, currentUser, onLogout }: AppShellProps) {
  const visibleNavigation = navigation.filter((item) =>
    canAccessNavigationItem(currentUser?.permissions, item),
  );

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-og-dark">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-black/20 bg-og-dark text-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-og-green font-poppins text-lg font-bold">
            OG
          </span>
          <div>
            <p className="font-poppins text-lg font-semibold">OGFI Inventory</p>
            <p className="text-xs text-white/60">Costing and sync console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavigation.map((item) => (
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              href={item.href}
              key={item.href}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          ))}
        </nav>

        {currentUser ? (
          <div className="border-t border-white/10 p-3">
            <div className="rounded-md border border-white/10 bg-white/5 p-3">
              <div className="flex items-start gap-2">
                <Icon
                  name="ShieldCheck"
                  size={18}
                  className="mt-0.5 text-green-300"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {currentUser.fullName}
                  </p>
                  <p className="truncate text-xs font-semibold text-white/60">
                    {currentUser.role.name}
                  </p>
                </div>
              </div>
              {onLogout ? (
                <button
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-white hover:bg-white/15"
                  onClick={onLogout}
                  type="button"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-og-line bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-og-green font-poppins font-bold text-white">
                OG
              </span>
              <span className="font-poppins text-lg font-semibold">
                OGFI Inventory
              </span>
            </div>

            <div className="hidden items-center gap-2 rounded-md border border-og-line bg-white px-3 py-2 text-sm text-og-gray lg:flex">
              <Icon name="MapPin" size={18} className="text-og-green" />
              Location: All accessible branches
            </div>

            <ConnectionStatus variant="pills" />
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-og-line px-4 py-2 lg:hidden">
            {visibleNavigation.map((item) => (
              <Link
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-og-line bg-white px-3 py-2 text-xs font-semibold text-og-dark"
                href={item.href}
                key={item.href}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            ))}
          </nav>
          <ConnectionStatus variant="banner" />
        </header>

        <main className="px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
