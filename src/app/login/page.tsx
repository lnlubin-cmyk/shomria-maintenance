"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Step = "phone" | "otp";

/**
 * useSearchParams() bails out of prerendering, which Next 14 rejects at build
 * time unless it sits under a Suspense boundary.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="card text-center text-sm text-gray-500">טוען...</div>
      </div>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/faults";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      const res = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "שגיאה. נסה שוב.");
        return;
      }

      // Only send a real OTP to a registered resident, but always advance to the
      // code step so an unregistered caller cannot tell the difference.
      if (data.registered) {
        const supabase = createClient();
        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone: data.phone,
        });
        if (otpError) {
          setError("שליחת הקוד נכשלה. נסה שוב.");
          return;
        }
      }

      setNormalizedPhone(data.phone);
      setStep("otp");
      setNotice("אם המספר רשום ברשימת התושבים, נשלח אליו קוד אימות ב-SMS.");
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: code,
        type: "sms",
      });

      if (verifyError) {
        setError("הקוד שגוי או פג תוקף.");
        return;
      }

      // Create the users row on first sign-in.
      const linkRes = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      if (!linkRes.ok) {
        const data = await linkRes.json();
        setError(data.error ?? "שגיאה בהרשמה.");
        await supabase.auth.signOut();
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

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            ← חזרה לדף הבית
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">כניסה למערכת</h1>
          <p className="mt-1 text-sm text-gray-600">קיבוץ שומריה — ניהול תחזוקה</p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</div>
          )}

          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
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
                <p className="mt-1 text-xs text-gray-500">
                  הכניסה מותרת לחברי הישוב בלבד, לפי מספר הטלפון הרשום.
                </p>
              </div>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "שולח..." : "שלח קוד אימות"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="label" htmlFor="code">
                  קוד אימות
                </label>
                <input
                  id="code"
                  className="field text-center text-lg tracking-widest"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "מאמת..." : "כניסה"}
              </button>

              <button
                type="button"
                className="w-full text-sm text-gray-600 hover:underline"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                  setNotice(null);
                }}
              >
                שינוי מספר טלפון
              </button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-500">או</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button type="button" onClick={handleGoogle} className="btn-secondary w-full">
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.16 6.16-4.16z"
              />
            </svg>
            כניסה עם Google
          </button>
        </div>
      </div>
    </main>
  );
}
