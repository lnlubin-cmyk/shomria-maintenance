"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Building, BuildingLayer, Campaign, CommunityItem, Contact, HomeMedia, Resident } from "@/lib/types";
import type { MoveHouse } from "@/lib/houses";
import UsersTab from "./UsersTab";
import ResidentsTab from "./ResidentsTab";
import BuildingsTab from "./BuildingsTab";
import CommunityTab from "./CommunityTab";
import MomentsTab from "./MomentsTab";
import EventsTab from "./EventsTab";
import HomeMediaTab from "./HomeMediaTab";
import HalachicTab from "./HalachicTab";
import PrayerTimesTab from "./PrayerTimesTab";
import TorahLessonsTab from "./TorahLessonsTab";
import ContactsTab from "./ContactsTab";
import CampaignTab from "./CampaignTab";
import type { PrayerSchedule } from "@/lib/prayer-times";

// Heavy / rarely-opened tabs are loaded only when their tab is first selected, so
// they stay out of the initial /admin bundle. (Same UI — just deferred.)
const TabLoading = () => <div className="py-10 text-center text-sm text-gray-500">טוען…</div>;
const BuildingsMapTab = dynamic(() => import("./BuildingsMapTab"), { ssr: false, loading: TabLoading });
const NewsletterTab = dynamic(() => import("./NewsletterTab"), { loading: TabLoading });
const VotesTab = dynamic(() => import("./VotesTab"), { loading: TabLoading });
const MoveTab = dynamic(() => import("./MoveTab"), { loading: TabLoading });
import type { CommunityEvent, Moment, TorahLesson } from "@/lib/types";
import type { AdminVote } from "@/lib/votes";

type Tab =
  | "users"
  | "residents"
  | "buildings"
  | "map"
  | "community"
  | "moments"
  | "events"
  | "newsletter"
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

// Human labels per leaf tab (used by the sub-tab bars).
const LEAF_LABELS: Record<Tab, string> = {
  users: "משתמשים",
  residents: "תושבים",
  buildings: "מבנים",
  map: "מפה",
  moves: "מעבר דירות",
  community: "קהילה/מידע לתושב",
  moments: "רגעים שזוכרים",
  events: "אירועים",
  newsletter: "פיצול ידיעון",
  media: "מדיה בדף הבית",
  halachic: "זמנים הלכתיים",
  religion: "תורה ותפילה",
  contacts: "צור קשר",
  campaigns: "קמפיין",
  votes: "הצבעות",
};

// Top-level navigation: two grouping tabs (each with sub-tabs) followed by the
// remaining standalone tabs.
type TopEntry =
  | { kind: "group"; key: "people" | "display"; label: string; tabs: Tab[] }
  | { kind: "leaf"; key: Tab; label: string };

const TOP: TopEntry[] = [
  {
    kind: "group",
    key: "people",
    label: "ניהול משתמשים ומבנים",
    tabs: ["users", "residents", "buildings", "map", "moves"],
  },
  {
    kind: "group",
    key: "display",
    label: "ניהול פריטי תצוגה",
    tabs: ["community", "moments", "events"],
  },
  { kind: "leaf", key: "newsletter", label: LEAF_LABELS.newsletter },
  { kind: "leaf", key: "media", label: LEAF_LABELS.media },
  { kind: "leaf", key: "halachic", label: LEAF_LABELS.halachic },
  { kind: "leaf", key: "religion", label: LEAF_LABELS.religion },
  { kind: "leaf", key: "contacts", label: LEAF_LABELS.contacts },
  { kind: "leaf", key: "campaigns", label: LEAF_LABELS.campaigns },
  { kind: "leaf", key: "votes", label: LEAF_LABELS.votes },
];

export default function AdminTabs({
  residents,
  buildings,
  users,
  layers,
  community,
  moments,
  events,
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
}: {
  residents: Resident[];
  buildings: Building[];
  users: AdminUserRow[];
  layers: BuildingLayer[];
  community: CommunityItem[];
  moments: Moment[];
  events: (CommunityEvent & { imageUrl: string | null; docUrl: string | null })[];
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
}) {
  // Which top-level entry is open (a group key or a standalone leaf key)...
  const [top, setTop] = useState<string>("people");
  // ...and which leaf is selected inside each group (remembered per group).
  const [sub, setSub] = useState<Record<string, Tab>>({ people: "users", display: "community" });
  // Sub-tab inside the "תורה ותפילה" leaf.
  const [religionSub, setReligionSub] = useState<"prayers" | "torah">("prayers");

  const activeGroup = TOP.find((e) => e.kind === "group" && e.key === top) as
    | Extract<TopEntry, { kind: "group" }>
    | undefined;
  const activeLeaf: Tab = activeGroup ? sub[top] ?? activeGroup.tabs[0] : (top as Tab);

  function renderLeaf(tab: Tab) {
    switch (tab) {
      case "users":
        return <UsersTab users={users} residents={residents} currentUserId={currentUserId} />;
      case "residents":
        return <ResidentsTab residents={residents} />;
      case "buildings":
        return <BuildingsTab buildings={buildings} residents={residents} layers={layers} />;
      case "map":
        return <BuildingsMapTab buildings={buildings} />;
      case "moves":
        return <MoveTab houses={moveHouses} />;
      case "community":
        return <CommunityTab items={community} />;
      case "moments":
        return <MomentsTab moments={moments} />;
      case "events":
        return <EventsTab events={events} />;
      case "newsletter":
        return <NewsletterTab aiConfigured={aiConfigured} />;
      case "media":
        return <HomeMediaTab items={homeMedia} />;
      case "halachic":
        return <HalachicTab years={halachicYears} />;
      case "religion":
        return (
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
        );
      case "contacts":
        return <ContactsTab contacts={contacts} />;
      case "campaigns":
        return <CampaignTab items={campaigns} />;
      case "votes":
        return <VotesTab votes={votes} residents={residents} />;
      default:
        return null;
    }
  }

  return (
    <div>
      {/* Top-level tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {TOP.map((e) => (
          <button
            key={e.key}
            onClick={() => setTop(e.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition ${
              top === e.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs for the active group */}
      {activeGroup && (
        <div className="mb-6 flex flex-wrap gap-2">
          {activeGroup.tabs.map((t) => (
            <button
              key={t}
              onClick={() => setSub((prev) => ({ ...prev, [top]: t }))}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                activeLeaf === t
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {LEAF_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {renderLeaf(activeLeaf)}
    </div>
  );
}
