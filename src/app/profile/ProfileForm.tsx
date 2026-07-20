"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_PHONE, CONSENT_HOUSE } from "@/lib/consent";
import { saveConsent } from "./actions";

/** A toggle for one consent statement. */
function ConsentToggle({
  statement,
  value,
  onChange,
}: {
  statement: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-700">{statement}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          value ? "bg-brand-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            value ? "left-0.5" : "left-[22px]"
          }`}
        />
      </button>
    </label>
  );
}

export default function ProfileForm({
  initialSharePhone,
  initialShareHouse,
}: {
  initialSharePhone: boolean;
  initialShareHouse: boolean;
}) {
  const router = useRouter();
  const [sharePhone, setSharePhone] = useState(initialSharePhone);
  const [shareHouse, setShareHouse] = useState(initialShareHouse);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = sharePhone !== initialSharePhone || shareHouse !== initialShareHouse;

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    const result = await saveConsent(sharePhone, shareHouse);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold">הגדרות פרטיות</h2>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {saved && !dirty && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">ההעדפות נשמרו.</div>
      )}

      <div className="space-y-4">
        <ConsentToggle statement={CONSENT_HOUSE} value={shareHouse} onChange={setShareHouse} />
        <ConsentToggle statement={CONSENT_PHONE} value={sharePhone} onChange={setSharePhone} />
      </div>

      <button className="btn-primary" onClick={save} disabled={busy || !dirty}>
        {busy ? "שומר..." : "שמירה"}
      </button>
    </div>
  );
}
