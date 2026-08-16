import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import {
  Home,
  Search,
  History,
  FileText,
  ShieldCheck,
  LogOut,
  ClipboardCheck,
} from "lucide-react";

import { supabase } from "../lib/supabase";

const items = [
  ["/", "Home", Home],
  ["/scan", "New scan", Search],
  ["/history", "Scan history", History],
  [
    "/review-results",
    "Review results",
    ClipboardCheck,
  ],
  [
    "/removals",
    "Removal requests",
    FileText,
  ],
];

export default function Layout() {
  const navigate =
    useNavigate();

  async function signOut() {
    await supabase.auth.signOut();

    navigate(
      "/login"
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="border-b border-slate-200 bg-slate-950 text-white md:min-h-screen md:w-64 md:border-b-0">
        <div className="p-5">
          <div className="text-xl font-semibold">
            Footprint
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Digital exposure manager
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1">
          {items.map(
            ([
              to,
              label,
              Icon,
            ]) => (
              <NavLink
                key={to}
                to={to}
                className={({
                  isActive,
                }) =>
                  `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                    isActive
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-slate-900"
                  }`
                }
              >
                <Icon
                  size={17}
                />

                {label}
              </NavLink>
            )
          )}
        </nav>

        {/*
         * Admin review is intentionally not included
         * in the normal-user navigation.
         *
         * The /admin route can remain in App.jsx,
         * but access is controlled by the backend
         * requireAdmin middleware.
         */}
        <div className="mx-3 mt-2 rounded-xl border border-slate-800 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck
              size={15}
            />

            Administrator review
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Access restricted in this prototype.
          </p>
        </div>

        <button
          onClick={
            signOut
          }
          className="m-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
        >
          <LogOut
            size={17}
          />

          Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}