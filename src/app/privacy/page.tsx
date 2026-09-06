import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = {
  title: "מדיניות פרטיות — שומרינט",
  description: "מדיניות הפרטיות של אפליקציית שומרינט (קהילת עצמונה-שומריה).",
};

/**
 * Public privacy policy — required by Google Play (store listing + Data Safety).
 * Intentionally NOT login-gated so Play reviewers and users can reach it.
 * DRAFT: review the contact address and confirm it reflects actual practice.
 */
export default function PrivacyPage() {
  const updated = "ספטמבר 2026";
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center">
            <Logo className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <article className="card space-y-5 text-gray-800 leading-relaxed">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">מדיניות פרטיות</h1>
            <p className="mt-1 text-sm text-gray-500">אפליקציית „שומרינט” — קהילת עצמונה-שומריה · עודכן: {updated}</p>
          </div>

          <p>
            אפליקציית „שומרינט” (להלן „האפליקציה”) נועדה לספק לחברי קהילת עצמונה-שומריה מידע ושירותים:
            פנייה לצוות החצר, מידע לתושב, זמני תפילות, אירועים, הצבעות ועוד. מדיניות זו מסבירה איזה מידע
            נאסף, כיצד הוא משמש וכיצד הוא מוגן.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">איזה מידע אנו אוספים</h2>
            <ul className="list-disc space-y-1 pe-5">
              <li><b>מספר טלפון</b> — לצורך הזדהות וכניסה למערכת באמצעות קוד חד-פעמי (SMS).</li>
              <li><b>שם וכתובת דוא״ל</b> (אם נמסרו) — לזיהוי המשתמש ולתצוגה בתוך הקהילה.</li>
              <li><b>פרטי מגורים</b> — שיוך לבית/מבנה ביישוב, לצורך שירותי התושב והמפה.</li>
              <li><b>תוכן שהמשתמש יוצר</b> — קריאות תקלה, הצבעות ופניות שאתם מזינים באפליקציה.</li>
            </ul>
            <p className="text-sm text-gray-600">האפליקציה אינה אוספת מיקום מדויק, אינה כוללת פרסומות ואינה עוקבת אחר המשתמשים לצרכים שיווקיים.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">כיצד המידע משמש</h2>
            <ul className="list-disc space-y-1 pe-5">
              <li>אימות זהות וכניסה מאובטחת למערכת.</li>
              <li>מתן שירותי התושב — טיפול בקריאות תקלה, הצגת מידע קהילתי, אירועים והצבעות.</li>
              <li>הצגת ספר טלפונים ומפת היישוב לחברי הקהילה (בכפוף להרשאות השיתוף שהגדרתם).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">שיתוף מידע עם צד שלישי</h2>
            <p>איננו מוכרים מידע אישי. המידע מעובד באמצעות ספקי תשתית בלבד, לצורך הפעלת האפליקציה:</p>
            <ul className="list-disc space-y-1 pe-5">
              <li><b>Supabase</b> — בסיס נתונים, אחסון קבצים והזדהות.</li>
              <li><b>Vercel</b> — אירוח האתר/האפליקציה.</li>
              <li><b>ספק שליחת SMS</b> — למשלוח קוד ההזדהות החד-פעמי.</li>
              <li><b>GovMap</b> — שכבת המפה הממשלתית (לתצוגת מפת היישוב).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">אבטחה ושמירת מידע</h2>
            <p>
              המידע מועבר בתקשורת מוצפנת (HTTPS) ונשמר בגישה מוגבלת. אנו שומרים את המידע כל עוד חשבונך פעיל
              או ככל שנדרש לצורך אספקת השירותים.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">הזכויות שלך</h2>
            <p>
              באפשרותך לעיין בפרטיך, לעדכן אותם או לבקש את מחיקת חשבונך והמידע הקשור אליו. לבקשות אלו יש
              לפנות אלינו (ראו „יצירת קשר”).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">יצירת קשר</h2>
            <p>
              לשאלות או בקשות בנושא פרטיות ניתן לפנות דרך עמוד{" "}
              <Link href="/contact" className="text-brand-600 underline">
                צור קשר
              </Link>{" "}
              באפליקציה, או בדוא״ל: <span className="font-medium">[יש למלא כתובת דוא״ל ליצירת קשר]</span>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">שינויים במדיניות</h2>
            <p>ייתכן שנעדכן מדיניות זו מעת לעת. גרסה מעודכנת תפורסם בעמוד זה עם תאריך העדכון.</p>
          </section>
        </article>
      </main>
    </div>
  );
}
