"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * login       — returning user: email + password (no email code).
 * verify-email — first login / forgot password: enter email to get a code.
 * verify-code  — enter the emailed code.
 * set-password — after verifying, choose a password for future logins.
 */
type Step = "login" | "verify-email" | "verify-code" | "set-password";

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

const MIN_PASSWORD = 8;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/faults";

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [normalizedEmail, setNormalizedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const e = params.get("error");
    return e ? (SSO_ERRORS[e] ?? null) : null;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  // Returning user: email + password, no email code.
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signErr) {
        setError("אימייל או סיסמה שגויים. אם זו כניסה ראשונה, בחר „כניסה ראשונה / שכחתי סיסמה”.");
        return;
      }

      // Ensure the users row exists (it does for any real account; this also
      // rejects an auth account that somehow isn't a resident).
      const linkRes = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!linkRes.ok) {
        const d = await linkRes.json();
        setError(d.error ?? "שגיאה. נסה שוב.");
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

  // First login / forgot password: send an email code.
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
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

      // Only send a code to a registered resident, but always advance so an
      // unregistered address can't be told apart.
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
      setStep("verify-code");
      setNotice("אם האימייל רשום ברשימת התושבים, נשלח אליו קוד אימות.");
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  // Verify the emailed code, then move on to choosing a password.
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
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

      // Create the users row on first sign-in (idempotent for existing ones).
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

      setStep("set-password");
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  // Set the password. The session is already active from the code step.
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    if (password.length < MIN_PASSWORD) {
      setError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD} תווים.`);
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) {
        setError("שמירת הסיסמה נכשלה. נסה סיסמה אחרת.");
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

  const titles: Record<Step, string> = {
    login: "כניסה למערכת",
    "verify-email": "כניסה ראשונה / שכחתי סיסמה",
    "verify-code": "אימות כתובת האימייל",
    "set-password": "בחירת סיסמה",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            ← חזרה לדף הבית
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{titles[step]}</h1>
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

          {step === "login" && (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
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
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label" htmlFor="password">
                    סיסמה
                  </label>
                  <input
                    id="password"
                    className="field"
                    type="password"
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary w-full" disabled={busy}>
                  {busy ? "נכנס..." : "כניסה"}
                </button>
              </form>

              <button
                type="button"
                className="mt-3 w-full text-sm text-brand-600 hover:underline"
                onClick={() => {
                  resetMessages();
                  setPassword("");
                  setStep("verify-email");
                }}
              >
                כניסה ראשונה / שכחתי סיסמה
              </button>
            </>
          )}

          {step === "verify-email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <p className="text-sm text-gray-600">
                בכניסה הראשונה, או אם שכחת את הסיסמה, נשלח קוד אימות לאימייל שלך ולאחר מכן תוכל לבחור
                סיסמה.
              </p>
              <div>
                <label className="label" htmlFor="verify-email-input">
                  כתובת אימייל
                </label>
                <input
                  id="verify-email-input"
                  className="field"
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "שולח..." : "שלח קוד אימות"}
              </button>

              <button
                type="button"
                className="w-full text-sm text-gray-600 hover:underline"
                onClick={() => {
                  resetMessages();
                  setStep("login");
                }}
              >
                חזרה לכניסה עם סיסמה
              </button>
            </form>
          )}

          {step === "verify-code" && (
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
                {busy ? "מאמת..." : "אימות"}
              </button>

              <button
                type="button"
                className="w-full text-sm text-gray-600 hover:underline"
                onClick={() => {
                  resetMessages();
                  setCode("");
                  setStep("verify-email");
                }}
              >
                שינוי כתובת אימייל
              </button>
            </form>
          )}

          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <p className="text-sm text-gray-600">
                האימייל אומת. בחר סיסמה — בכניסות הבאות תוכל להיכנס עם האימייל והסיסמה בלבד.
              </p>
              <div>
                <label className="label" htmlFor="new-password">
                  סיסמה חדשה
                </label>
                <input
                  id="new-password"
                  className="field"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  placeholder={`לפחות ${MIN_PASSWORD} תווים`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label" htmlFor="confirm-password">
                  אימות סיסמה
                </label>
                <input
                  id="confirm-password"
                  className="field"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "שומר..." : "שמירה וכניסה"}
              </button>
            </form>
          )}

          {step === "login" && (
            <>
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
