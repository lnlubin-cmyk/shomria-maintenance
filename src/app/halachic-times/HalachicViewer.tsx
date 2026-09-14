"use client";

import { useEffect, useState } from "react";

// Same display cleanups as the "today" card.
const LABEL_OVERRIDES: Record<string, string> = {
  "השקיעה במישור": "שקיעה לחומרא (במישור)",
  "שקיעה במישור": "שקיעה לחומרא (במישור)",
  "שקיעה בגובה": "שקיעה",
};
const fixLabel = (l: string) => (LABEL_OVERRIDES[l] ?? l).replace(/מעלו(?!ת)/g, "מעלות");

type Month = { hebrew_year: number; month_name: string };
type Day = { hebrew_day: number; day_title: string | null; times: { label: string; time: string }[] };

/** Browse the loaded halachic times for any month/day (not only today). */
export default function HalachicViewer({ months }: { months: Month[] }) {
  const [monthIdx, setMonthIdx] = useState(0);
  const [days, setDays] = useState<Day[] | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const cur = months[monthIdx];

  useEffect(() => {
    if (!cur) return;
    let cancelled = false;
    setLoading(true);
    setDays(null);
    setDayIdx(0);
    fetch(`/api/halachic/month?year=${cur.hebrew_year}&month=${encodeURIComponent(cur.month_name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDays(d.days ?? []);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cur?.hebrew_year, cur?.month_name]);

  if (months.length === 0) return null;

  const day = days?.[dayIdx];

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-bold text-gray-900">צפייה בלוח לתאריך אחר</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-600">
            חודש
            <select
              className="field mt-1"
              value={monthIdx}
              onChange={(e) => setMonthIdx(Number(e.target.value))}
            >
              {months.map((m, i) => (
                <option key={`${m.hebrew_year}-${m.month_name}`} value={i}>
                  {m.month_name} {m.hebrew_year}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-600">
            יום
            <select
              className="field mt-1"
              value={dayIdx}
              onChange={(e) => setDayIdx(Number(e.target.value))}
              disabled={!days || days.length === 0}
            >
              {(days ?? []).map((d, i) => (
                <option key={d.hebrew_day} value={i}>
                  {d.hebrew_day}
                  {d.day_title ? ` · ${d.day_title}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-center text-sm text-gray-500">טוען…</p>
          ) : !day || day.times.length === 0 ? (
            <p className="text-center text-sm text-gray-500">אין זמנים ליום זה.</p>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              {day.times.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <span className="text-gray-700">{fixLabel(item.label)}</span>
                  <span className="font-semibold tabular-nums text-gray-900" dir="ltr">
                    {item.time}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
