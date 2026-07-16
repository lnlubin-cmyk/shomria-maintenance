"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Post-SSO step. Google told us who the account is, but the spec identifies
 * residents by phone — so we ask for it once and match it to the residents table.
 *
 * Suspense boundary: useSearchParams() bails out of prerendering, which Next 14
 * rejects at build time without one.
 */
export default function LinkAccountPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-4">
          <div className="card text-sm text-gray-500">טוען...</div>
        </main>
      }
    >
      <LinkAccountForm />
    </Suspense>
  );
}

function LinkAccountForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/faults";

  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "שגיאה. נסה שוב.");
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-gray-50 p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-bold">השלמת הרשמה</h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          כדי לאמת שאתה חבר הישוב, הזן את מספר הטלפון הרשום ברשימת התושבים.
        </p>

        <div className="card">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="phone">
                מספר טלפון
              </label>
              <input
                id="phone"
                className="field"
                type="tel"
                dir="ltr"
                inputMode="tel"
                placeholder="050-123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "מאמת..." : "אישור"}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="w-full text-sm text-gray-600 hover:underline"
            >
              ביטול והתנתקות
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
