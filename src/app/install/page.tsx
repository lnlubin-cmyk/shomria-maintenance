import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = {
  title: "התקנת האפליקציה — שומרינט",
  description: "מדריך להתקנת אפליקציית שומרינט (קהילת עצמונה-שומריה) על הטלפון.",
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
        {n}
      </span>
      <span className="pt-0.5 leading-relaxed">{children}</span>
    </li>
  );
}

/** Public how-to-install guide (PWA "Add to Home Screen"). Not login-gated. */
export default function InstallPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center">
            <Logo className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">התקנת האפליקציה על הטלפון</h1>
          <p className="mt-2 text-gray-700 leading-relaxed">
            אפשר להתקין את „שומרינט” ישירות מהאתר — בלי חנות אפליקציות. לאחר ההתקנה יופיע סמל
            האפליקציה במסך הבית, והיא תיפתח במסך מלא כמו כל אפליקציה רגילה.
          </p>
        </div>

        {/* Android */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="text-2xl">🤖</span> אנדרואיד (Samsung, Xiaomi וכו׳)
          </h2>
          <p className="text-sm text-gray-600">בדפדפן <b>Chrome</b>:</p>
          <ol className="space-y-3 text-gray-800">
            <Step n={1}>
              פתחו את הכתובת <b>www.shomriya.com</b> בדפדפן Chrome.
            </Step>
            <Step n={2}>
              הקישו על תפריט שלוש הנקודות <b>(⋮)</b> בפינה העליונה של המסך.
            </Step>
            <Step n={3}>
              בחרו <b>„התקנת אפליקציה”</b> (או „הוספה למסך הבית” / „Install app”).
            </Step>
            <Step n={4}>הקישו <b>„התקנה”</b> לאישור.</Step>
            <Step n={5}>סמל האפליקציה יופיע במסך הבית — הקישו עליו כדי לפתוח.</Step>
          </ol>
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            לעיתים יופיע מעצמו באתר חלון קטן „התקנת אפליקציה” — אפשר פשוט להקיש עליו.
            <br />
            במכשירי Samsung עם דפדפן „אינטרנט” של סמסונג: הקישו על התפריט ובחרו „הוספת דף אל” →
            „מסך הבית”.
          </p>
        </section>

        {/* iPhone */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="text-2xl">📱</span> אייפון (iPhone)
          </h2>
          <p className="text-sm text-gray-600">
            חובה להשתמש בדפדפן <b>Safari</b> (לא Chrome):
          </p>
          <ol className="space-y-3 text-gray-800">
            <Step n={1}>
              פתחו את הכתובת <b>www.shomriya.com</b> בדפדפן <b>Safari</b>.
            </Step>
            <Step n={2}>
              הקישו על כפתור <b>השיתוף</b> (ריבוע עם חץ כלפי מעלה) בתחתית המסך.
            </Step>
            <Step n={3}>
              גללו מעט ובחרו <b>„הוספה למסך הבית”</b> (Add to Home Screen).
            </Step>
            <Step n={4}>
              הקישו <b>„הוספה”</b> בפינה העליונה.
            </Step>
            <Step n={5}>הסמל יופיע במסך הבית — הקישו עליו כדי לפתוח.</Step>
          </ol>
        </section>

        {/* Windows */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="text-2xl">🖥️</span> מחשב Windows
          </h2>
          <p className="text-sm text-gray-600">
            בדפדפן <b>Chrome</b> או <b>Edge</b>:
          </p>
          <ol className="space-y-3 text-gray-800">
            <Step n={1}>
              פתחו את הכתובת <b>www.shomriya.com</b> בדפדפן Chrome או Edge.
            </Step>
            <Step n={2}>
              בשורת הכתובת שלמעלה, הקישו על <b>סמל ההתקנה</b> — מסך קטן עם חץ, שמופיע בצד שורת הכתובת.
            </Step>
            <Step n={3}>
              לחלופין דרך התפריט: ב-Chrome הקישו על <b>(⋮)</b> ובחרו „התקנת אפליקציה”; ב-Edge הקישו על{" "}
              <b>(⋯)</b> → „אפליקציות” → „התקנת אתר זה כאפליקציה”.
            </Step>
            <Step n={4}>לחצו <b>„התקנה”</b>.</Step>
            <Step n={5}>
              האפליקציה תיפתח בחלון נפרד ותתווסף לתפריט „התחל” (ואפשר להצמיד אותה לשורת המשימות).
            </Step>
          </ol>
        </section>

        {/* After install */}
        <section className="card space-y-2">
          <h2 className="text-lg font-bold text-gray-900">אחרי ההתקנה</h2>
          <p className="text-gray-800 leading-relaxed">
            פתחו את האפליקציה מהסמל שנוצר (במסך הבית בטלפון, או בתפריט „התחל” במחשב), והתחברו באמצעות
            מספר הטלפון שלכם — יישלח אליכם קוד חד-פעמי ב-SMS. הכניסה מיועדת לחברי הקהילה.
          </p>
        </section>

        {/* Video guide — registration / login */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="text-2xl">🎬</span> סרטון הדרכה — הרשמה וכניסה
          </h2>
          <p className="text-gray-800 leading-relaxed">צפו בסרטון קצר שמדגים כיצד להירשם ולהתחבר לאפליקציה:</p>
          <div className="mx-auto w-full max-w-[360px]">
            <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
              <iframe
                src="https://www.youtube.com/embed/_eRcjhFbS8Y"
                title="סרטון הדרכה — הרשמה וכניסה"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="card space-y-2">
          <h2 className="text-lg font-bold text-gray-900">לא מוצאים את אפשרות ההתקנה?</h2>
          <ul className="list-disc space-y-1 pe-5 text-gray-800">
            <li>ודאו שאתם משתמשים ב-Chrome (באנדרואיד) או ב-Safari (באייפון).</li>
            <li>רעננו את הדף ונסו שוב.</li>
            <li>אם האפליקציה כבר מותקנת, לא תופיע שוב אפשרות ההתקנה.</li>
          </ul>
        </section>

        <div className="text-center">
          <Link href="/" className="btn-primary">
            למעבר לאתר
          </Link>
        </div>
      </main>
    </div>
  );
}
