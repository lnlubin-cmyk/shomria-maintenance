"use client";

import { useState } from "react";
import type { Building, Resident } from "@/lib/types";
import UsersTab from "./UsersTab";
import ResidentsTab from "./ResidentsTab";
import BuildingsTab from "./BuildingsTab";

type Tab = "users" | "residents" | "buildings";

export interface AdminUserRow {
  id: string;
  resident_id: string | null;
  role: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  resident: { first_name: string; last_name: string } | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "משתמשים" },
  { key: "residents", label: "תושבים" },
  { key: "buildings", label: "מבנים" },
];

export default function AdminTabs({
  residents,
  buildings,
  users,
  currentUserId,
}: {
  residents: Resident[];
  buildings: Building[];
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <UsersTab users={users} residents={residents} currentUserId={currentUserId} />
      )}
      {tab === "residents" && <ResidentsTab residents={residents} />}
      {tab === "buildings" && <BuildingsTab buildings={buildings} residents={residents} />}
    </div>
  );
}
