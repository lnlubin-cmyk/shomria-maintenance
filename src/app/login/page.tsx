"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "otp";

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

// Errors the SSO callback can redirect back with.
const SSO_ERRORS: Record<string, string> = {
  sso_not_registered: "כתובת ה-Google שלך אינה רשומה ברשימת התושבים. היכנס עם האימייל הרשום וקוד אימות.",
  account_exists: "לתושב זה כבר קיים חשבון במערכת. פנה למזכירות.",
  auth_failed: "ההתחברות עם Google נכשלה. נסה שוב.",
  link_failed: "אירעה שגיאה בהשלמת ההרשמה. נסה שוב.",
  missing_code: "ההתחברות עם Google נכשלה. נסה שוב.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/faults";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [normalizedEmail, setNormalizedEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const e = params.get("error");
    return e ? (SSO_ERRORS[e] ?? null) : null;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "שגיאה. נסה שוב.");
        return;
      }

      // Only send a real code to a registered resident, but always advance to the
      // code step so an unregistered caller cannot tell the difference.
      // shouldCreateUser:false — don't provision an auth account for an address
      // that isn't a resident, so this can't be used to mint junk accounts.
      if (data.registered) {
        const supabase = createClient();
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: data.email,
          options: { shouldCreateUser: true },
        });
        if (otpError) {
          setError("שליחת הקוד נכשלה. נסה שוב.");
          return;
        }
      }

      setNormalizedEmail(data.email);
      setStep("otp");
      setNotice("אם האימייל רשום ברשימת התושבים, נשלח אליו קוד אימות.");
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
        email: normalizedEmail,
        token: code,
        type: "email",
      });

      if (verifyError) {
        setError("הקוד שגוי או פג תוקף.");
        return;
      }

      // Create the users row on first sign-in.
      const linkRes = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
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

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">
                  כתובת אימייל
                </label>
                <input
                  id="email"
                  className="field"
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  הכניסה מותרת לחברי הישוב בלבד, לפי האימייל הרשום.
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
                {/* Supabase OTP length is configurable (6–10 digits) and newer
                    projects default to 8, so don't hard-code a width — accept
                    whatever length the emailed code is. */}
                <input
                  id="code"
                  className="field text-center text-lg tracking-widest"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="הזן את הקוד מהאימייל"
                  maxLength={10}
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
                  setStep("email");
                  setCode("");
                  setError(null);
                  setNotice(null);
                }}
              >
                שינוי כתובת אימייל
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
