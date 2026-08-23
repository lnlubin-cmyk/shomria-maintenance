"use client";

import { useState } from "react";
import PrayerTimesTab from "./PrayerTimesTab";
import TorahLessonsTab from "./TorahLessonsTab";
import HalachicTab from "./HalachicTab";
import type { PrayerSchedule } from "@/lib/prayer-times";
import type { TorahLesson } from "@/lib/types";

/**
 * The גבאי's limited management view: only the religious content — זמני תפילות,
 * שיעורי תורה, זמנים הלכתיים — reusing the very same tab components the admin
 * uses. A gabbai never receives (or can reach) any other admin data.
 */
type Tab = "prayers" | "torah" | "halachic";

const TABS: { key: Tab; label: string }[] = [
  { key: "prayers", label: "זמני תפילות" },
  { key: "torah", label: "שיעורי תורה" },
  { key: "halachic", label: "זמנים הלכתיים" },
];

export default function GabbaiTabs({
  schedules,
  lessons,
  halachicYears,
}: {
  schedules: PrayerSchedule[];
  lessons: TorahLesson[];
  halachicYears: { year: number; days: number }[];
}) {
  const [tab, setTab] = useState<Tab>("prayers");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
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

      {tab === "prayers" && <PrayerTimesTab schedules={schedules} />}
      {tab === "torah" && <TorahLessonsTab lessons={lessons} />}
      {tab === "halachic" && <HalachicTab years={halachicYears} />}
    </div>
  );
}
