import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";

/**
 * קו העירוב — presents the community eruv committee's published update: the
 * rules and the two official maps (entrance photo + satellite map of the area
 * excluded from the eruv). Static content transcribed from the committee's PDF.
 */
export const metadata = {
  title: "קו העירוב — קהילת עצמונה-שומריה",
};

const RULES: string[] = [
  "הישוב כולו מוקף בגדר, אבל ישנו שטח אחד שאינו נכלל בעירוב של הישוב והטלטול בו אסור מכיון שיש בו שדה זרועה, והוא השטח הדרום-מערבי בקצה הישוב. הכניסה לשטח זה מצדו המזרחי היא ליד מבנה הביוב, ומצדו הצפוני באמצע השביל ההיקפי, בסמוך לשער היציאה אל היער לכיוון בית הקברות (שער נעול). קו של עמודי עירוב (צורת הפתח) יוצא משער זה ועד סמוך לבית משפחת הריסון, הטלטול אסור דרומית לקו זה.",
  "בכל מקום בו יש כניסה לשטח האסור בטלטול, ישנו שילוט על עמודי העירוב 'עד כאן עירוב שבת'.",
  "למרות ההסתמכות על צורת הפתח, מכיון שלא מדובר על שטח המוגדר 'רשות הרבים דאורייתא' וכן ישנה גדר היקפית לכל השטח, לכן גם מי שחושש לדעות המחמירות ואינו מטלטל בשבת בעירוב של עיר (צורת הפתח), יכול לטלטל בכל הישוב ללא חשש.",
  "כמובן שמותר להיכנס לשטח זה בשבת, אך יש להקפיד שלא לטלטל שם חפצים, להוציא חפצים מהכיסים, לא להכניס עגלות ילדים או ילדים על הידיים, וכו'.",
  "כמו כן, מחוץ לשער הכניסה ליישוב ישנו שטח קטן המוקף בעמודי צורת הפתח, כדי להתיר את הטלטול עד לרכב החונה מחוץ לשער, לטובת הסעות של אחיות, אנשי בטחון שיוצאים ברכב וכדומה.",
  "הכל מפורט במפות המצורפות.",
];

export default async function EruvPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/eruv");

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader session={session} />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
              🔗
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">קו העירוב</h1>
              <p className="text-sm text-gray-600">עדכוני עירובין — אלול תשפ״ה</p>
            </div>
          </div>
          <p className="mt-4 text-gray-700">
            לטובת התושבים החדשים, וכתזכורת עבור כולנו, אנו מפרסמים שוב את מפת היקף העירוב של הישוב.
          </p>
        </header>

        {/* Key practical warning */}
        <div className="mb-6 rounded-xl border-r-4 border-amber-400 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">שימו לב</p>
          <p className="mt-1 text-sm text-amber-800">
            השטח הדרום-מערבי בקצה הישוב (מסומן במפה) אינו נכלל בעירוב, והטלטול בו אסור בשבת. בכל
            כניסה לשטח זה ישנו שילוט על עמודי העירוב: „עד כאן עירוב שבת”.
          </p>
        </div>

        {/* Rules */}
        <section className="card">
          <ol className="space-y-4">
            {RULES.map((rule, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-gray-700">{rule}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Maps */}
        <section className="mt-8 space-y-6">
          <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
            <span className="h-6 w-1.5 rounded-full bg-accent-500" />
            המפות
          </h2>

          <figure className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
            <a href="/eruv/map.jpg" target="_blank" rel="noopener noreferrer">
              <Image
                src="/eruv/map.jpg"
                alt="מפת לוויין של היקף העירוב — השטח האסור בטלטול מסומן באדום"
                width={918}
                height={822}
                className="h-auto w-full"
              />
            </a>
            <figcaption className="border-t border-gray-100 px-4 py-2.5 text-sm text-gray-600">
              מפת היקף העירוב — השטח האסור בטלטול מסומן. לחיצה על התמונה תפתח אותה בגודל מלא.
            </figcaption>
          </figure>

          <figure className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
            <a href="/eruv/entrance.jpg" target="_blank" rel="noopener noreferrer">
              <Image
                src="/eruv/entrance.jpg"
                alt="שער הכניסה לישוב — השטח המותר בטלטול מחוץ לשער"
                width={594}
                height={320}
                className="h-auto w-full"
              />
            </a>
            <figcaption className="border-t border-gray-100 px-4 py-2.5 text-sm text-gray-600">
              מחוץ לשער הכניסה — השטח המותר בטלטול עד לרכב החונה מחוץ לשער.
            </figcaption>
          </figure>
        </section>

        {/* Signature */}
        <footer className="mt-8 rounded-xl bg-gray-100 p-4 text-center text-sm text-gray-600">
          <p>לשאלות ובירורים ניתן לפנות אלינו</p>
          <p className="mt-1 font-medium text-gray-800">אופיר ברינר ופתחיה דיאמנט</p>
          <p>צוות עירובין יישובי</p>
        </footer>
      </main>
    </div>
  );
}
