"use client";

import { useState } from "react";
import type { Building, BuildingLayer, Campaign, CommunityItem, Contact, HomeMedia, Resident } from "@/lib/types";
import type { MoveHouse } from "@/lib/houses";
import UsersTab from "./UsersTab";
import ResidentsTab from "./ResidentsTab";
import BuildingsTab from "./BuildingsTab";
import BuildingsMapTab from "./BuildingsMapTab";
import CommunityTab from "./CommunityTab";
import HomeMediaTab from "./HomeMediaTab";
import HalachicTab from "./HalachicTab";
import PrayerTimesTab from "./PrayerTimesTab";
import TorahLessonsTab from "./TorahLessonsTab";
import ContactsTab from "./ContactsTab";
import CampaignTab from "./CampaignTab";
import MoveTab from "./MoveTab";
import VotesTab from "./VotesTab";
import type { PrayerSchedule } from "@/lib/prayer-times";
import type { TorahLesson } from "@/lib/types";
import type { AdminVote } from "@/lib/votes";

type Tab =
  | "users"
  | "residents"
  | "buildings"
  | "map"
  | "community"
  | "media"
  | "halachic"
  | "prayers"
  | "torah"
  | "contacts"
  | "campaigns"
  | "moves"
  | "votes";

export interface AdminUserRow {
  id: string;
  resident_id: string | null;
  role: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  resident: { first_name: string; last_name: string; is_member: boolean } | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "משתמשים" },
  { key: "residents", label: "תושבים" },
  { key: "buildings", label: "מבנים" },
  { key: "map", label: "מפה" },
  { key: "moves", label: "מעבר דירות" },
  { key: "community", label: "קהילה" },
  { key: "media", label: "מדיה בדף הבית" },
  { key: "halachic", label: "זמנים הלכתיים" },
  { key: "prayers", label: "זמני תפילות" },
  { key: "torah", label: "שיעורי תורה" },
  { key: "contacts", label: "צור קשר" },
  { key: "campaigns", label: "קמפיין" },
  { key: "votes", label: "הצבעות" },
];

export default function AdminTabs({
  residents,
  buildings,
  users,
  layers,
  community,
  homeMedia,
  halachicYears,
  schedules,
  lessons,
  contacts,
  campaigns,
  moveHouses,
  votes,
  currentUserId,
}: {
  residents: Resident[];
  buildings: Building[];
  users: AdminUserRow[];
  layers: BuildingLayer[];
  community: CommunityItem[];
  homeMedia: (HomeMedia & { previewUrl: string })[];
  halachicYears: { year: number; days: number }[];
  schedules: PrayerSchedule[];
  lessons: TorahLesson[];
  contacts: Contact[];
  campaigns: (Campaign & { previewUrl: string })[];
  moveHouses: MoveHouse[];
  votes: AdminVote[];
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
      {tab === "buildings" && (
        <BuildingsTab buildings={buildings} residents={residents} layers={layers} />
      )}
      {tab === "map" && <BuildingsMapTab buildings={buildings} />}
      {tab === "moves" && <MoveTab houses={moveHouses} />}
      {tab === "community" && <CommunityTab items={community} />}
      {tab === "media" && <HomeMediaTab items={homeMedia} />}
      {tab === "halachic" && <HalachicTab years={halachicYears} />}
      {tab === "prayers" && <PrayerTimesTab schedules={schedules} />}
      {tab === "torah" && <TorahLessonsTab lessons={lessons} />}
      {tab === "contacts" && <ContactsTab contacts={contacts} />}
      {tab === "campaigns" && <CampaignTab items={campaigns} />}
      {tab === "votes" && <VotesTab votes={votes} residents={residents} />}
    </div>
  );
}
