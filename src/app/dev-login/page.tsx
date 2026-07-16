"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * DEVELOPMENT ONLY — see src/app/api/dev-login/route.ts.
 *
 * The route returns 404 unless NODE_ENV !== "production" AND ENABLE_DEV_LOGIN
 * is set, so this page is inert in a production build. Delete both before
 * deploying.
 */
const ROLES = [
  { key: "resident", label: "תושב", who: "יוסי לוי", note: "רואה רק את הקריאות שלו" },
  { key: "maintenance", label: "איש תחזוקה", who: "משה אוחיון", note: "רואה הכל, עורך סטטוס וטיפול" },
  {
    key: "maintenance_manager",
    label: "מנהל תחזוקה",
    who: "רפי טל",
    note: "כמו איש תחזוקה + מחיקת תקלות",
  },
  { key: "admin", label: "אדמין", who: "דורית אלון", note: "הכל + מסך ניהול מערכת" },
];

export default function DevLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function signInAs(role: string) {
    setError(null);
    setBusy(role);

    try {
      const res = await fetch("/api/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (res.status === 404) {
        setError("כניסת פיתוח מושבתת. ודא ש-ENABLE_DEV_LOGIN=true בקובץ .env.local.");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה");
        return;
      }

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "email",
      });

      if (verifyError) {
        setError(`אימות נכשל: ${verifyError.message}`);
        return;
      }

      router.push(role === "resident" ? "/faults" : "/faults");
      router.refresh();
    } catch (e) {
      setError(`שגיאת רשת: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-4 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>מסך פיתוח בלבד.</strong> עוקף את מנגנון ההזדהות כדי לאפשר בדיקה ללא SMS. יש למחוק
          לפני העלייה לאוויר.
        </div>

        <div className="card">
          <h1 className="text-xl font-bold">כניסה מהירה לפי תפקיד</h1>
          <p className="mt-1 text-sm text-gray-600">בחר תפקיד כדי לראות את המערכת מנקודת מבטו.</p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          <div className="mt-5 space-y-2">
            {ROLES.map((r) => (
              <button
                key={r.key}
                onClick={() => signInAs(r.key)}
                disabled={busy !== null}
                className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white p-4 text-right transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50"
              >
                <div>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-gray-500">
                    {r.who} — {r.note}
                  </div>
                </div>
                <span className="text-sm text-brand-600">
                  {busy === r.key ? "נכנס..." : "כניסה ←"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
