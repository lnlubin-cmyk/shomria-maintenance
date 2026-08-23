"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { CONSENT_PHONE, CONSENT_HOUSE } from "@/lib/consent";
import { saveConsent } from "@/app/profile/actions";
import { normalizeIsraeliPhone, phoneAccountEmail, looksLikeEmail } from "@/lib/phone";

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
  sso_not_registered: "כתובת ה-Google שלך אינה רשומה ברשימת התושבים. היכנס עם מספר הטלפון הרשום וקוד אימות.",
  account_exists: "לתושב זה כבר קיים חשבון במערכת. פנה למזכירות.",
  auth_failed: "ההתחברות עם Google נכשלה. נסה שוב.",
  link_failed: "אירעה שגיאה בהשלמת ההרשמה. נסה שוב.",
  missing_code: "ההתחברות עם Google נכשלה. נסה שוב.",
};

const MIN_PASSWORD = 8;

/** Only allow same-origin relative redirects (blocks //evil.com and /\evil.com). */
function safeNext(raw: string | null): string {
  const n = raw ?? "/";
  return /^\/(?![/\\])/.test(n) ? n : "/";
}

/** A forced מאשר / לא מאשר choice for one consent statement. */
function ConsentChoice({
  statement,
  value,
  onChange,
}: {
  statement: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-700">{statement}</p>
      <div className="mt-1 flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={value === true} onChange={() => onChange(true)} />
          מאשר
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={value === false} onChange={() => onChange(false)} />
          לא מאשר
        </label>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState(""); // login identifier: email or phone
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  // Forced privacy choices at registration; null = not answered yet.
  const [sharePhone, setSharePhone] = useState<boolean | null>(null);
  const [shareHouse, setShareHouse] = useState<boolean | null>(null);
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

  // Returning user: (email or phone) + password, no code.
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const identifier = email.trim();
      let loginEmail: string;
      if (looksLikeEmail(identifier)) {
        loginEmail = identifier.toLowerCase();
      } else {
        const normalized = normalizeIsraeliPhone(identifier);
        if (!normalized) {
          setError("הזן מספר טלפון ישראלי תקין.");
          return;
        }
        loginEmail = phoneAccountEmail(normalized);
      }

      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signErr) {
        setError("הפרטים שגויים. אם זו כניסה ראשונה, בחר „כניסה ראשונה / שכחתי סיסמה”.");
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

  // First login / forgot password: send a code by SMS.
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה. נסה שוב.");
        return;
      }
      if (!data.eligible) {
        setError(
          "מספר הטלפון אינו מופיע ברשימת התושבים ואינו זכאי להרשמה. אנא הזן מספר אחר, או פנה למזכירה של משרד הקהילה לקבלת משתמש."
        );
        return;
      }
      setNormalizedPhone(phone);
      setStep("verify-code");
      setNotice("נשלח קוד אימות ב-SMS למספר הטלפון.");
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  // Verify the SMS code, then move on to choosing a password.
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const supabase = createClient();

      // Our route checks the code, ensures the account, and returns a one-time
      // token we exchange for a session.
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "הקוד שגוי או פג תוקף.");
        return;
      }
      const { error: sessErr } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: "email",
      });
      if (sessErr) {
        setError("אירעה שגיאה בהתחברות. נסה שוב.");
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
    if (sharePhone === null || shareHouse === null) {
      setError("יש לענות על שאלות הפרטיות.");
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
      await saveConsent(sharePhone, shareHouse);
      router.push(next);
      router.refresh();
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Step, string> = {
    login: "כניסה למערכת",
    "verify-email": "כניסה ראשונה / שכחתי סיסמה",
    "verify-code": "אימות מספר הטלפון",
    "set-password": "בחירת סיסמה",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            ← חזרה לדף הבית
          </Link>
          <Link href="/" className="mt-4 flex justify-center">
            <Logo className="h-20 w-auto" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{titles[step]}</h1>
          <p className="mt-1 text-sm text-gray-600">מידע ושירות לתושב</p>
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
                    מספר טלפון
                  </label>
                  <input
                    id="email"
                    className="field"
                    type="text"
                    dir="ltr"
                    autoComplete="username"
                    placeholder="050-123-4567"
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
                בכניסה הראשונה, או אם שכחת את הסיסמה, נשלח קוד אימות ב-SMS למספר הטלפון הרשום ברשימת
                התושבים, ולאחר מכן תוכל לבחור סיסמה.
              </p>

              <div>
                <label className="label" htmlFor="verify-phone-input">
                  מספר טלפון
                </label>
                <input
                  id="verify-phone-input"
                  className="field"
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="050-123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  נשלח קוד ב-SMS למספר הרשום ברשימת התושבים.
                </p>
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
                  placeholder="הזן את הקוד מה-SMS"
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
                שינוי מספר טלפון
              </button>
            </form>
          )}

          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <p className="text-sm text-gray-600">
                מספר הטלפון אומת. בחר סיסמה — בכניסות הבאות תוכל להיכנס עם מספר הטלפון והסיסמה בלבד.
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

              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-700">הגדרות פרטיות</p>
                <ConsentChoice statement={CONSENT_HOUSE} value={shareHouse} onChange={setShareHouse} />
                <ConsentChoice statement={CONSENT_PHONE} value={sharePhone} onChange={setSharePhone} />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "שומר..." : "שמירה וכניסה"}
              </button>
            </form>
          )}

        </div>
      </div>
    </main>
  );
}
