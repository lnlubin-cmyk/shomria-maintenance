"use client";

import { useState } from "react";
import type { Building, BuildingLayer, Campaign, CommunityItem, Contact, HomeMedia, Resident } from "@/lib/types";
import type { MoveHouse } from "@/lib/houses";
import UsersTab from "./UsersTab";
import ResidentsTab from "./ResidentsTab";
import BuildingsTab from "./BuildingsTab";
import BuildingsMapTab from "./BuildingsMapTab";
import CommunityTab from "./CommunityTab";
import NewsletterTab from "./NewsletterTab";
import PanelTab from "./PanelTab";
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
import type { InfoPanel } from "@/lib/info-panels-shared";
import type { AdminVote } from "@/lib/votes";

type Tab =
  | "users"
  | "residents"
  | "buildings"
  | "map"
  | "community"
  | "newsletter"
  | "clinic"
  | "store"
  | "media"
  | "halachic"
  | "religion"
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
  { key: "community", label: "קהילה/מידע לתושב" },
  { key: "newsletter", label: "פיצול ידיעון" },
  { key: "clinic", label: "מרפאה" },
  { key: "store", label: "מכולת" },
  { key: "media", label: "מדיה בדף הבית" },
  { key: "halachic", label: "זמנים הלכתיים" },
  { key: "religion", label: "תורה ותפילה" },
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
  aiConfigured,
  panels,
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
  aiConfigured: boolean;
  panels: InfoPanel[];
}) {
  const panelBySlug = (slug: string) => panels.find((p) => p.slug === slug);
  const [tab, setTab] = useState<Tab>("users");
  // Sub-tab inside the "תורה ותפילה" group.
  const [religionSub, setReligionSub] = useState<"prayers" | "torah">("prayers");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition ${
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
      {tab === "newsletter" && <NewsletterTab aiConfigured={aiConfigured} />}
      {tab === "clinic" && panelBySlug("clinic") && <PanelTab panel={panelBySlug("clinic")!} />}
      {tab === "store" && panelBySlug("store") && <PanelTab panel={panelBySlug("store")!} />}
      {tab === "media" && <HomeMediaTab items={homeMedia} />}
      {tab === "halachic" && <HalachicTab years={halachicYears} />}
      {tab === "religion" && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              { k: "prayers", label: "זמני תפילות" },
              { k: "torah", label: "שיעורי תורה" },
            ] as const).map((s) => (
              <button
                key={s.k}
                onClick={() => setReligionSub(s.k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                  religionSub === s.k
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {religionSub === "prayers" && <PrayerTimesTab schedules={schedules} />}
          {religionSub === "torah" && <TorahLessonsTab lessons={lessons} />}
        </div>
      )}
      {tab === "contacts" && <ContactsTab contacts={contacts} />}
      {tab === "campaigns" && <CampaignTab items={campaigns} />}
      {tab === "votes" && <VotesTab votes={votes} residents={residents} />}
    </div>
  );
}
