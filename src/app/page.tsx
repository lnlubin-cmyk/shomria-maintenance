import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import { isStaff } from "@/lib/types";

/**
 * A portal tile. A working tile links somewhere; a "בקרוב" tile is inert and
 * shows a coming-soon badge (feature not built yet).
 */
function Tile({
  href,
  icon,
  title,
  desc,
  soon,
}: {
  href?: string;
  icon: string;
  title: string;
  desc: string;
  soon?: boolean;
}) {
  const inner = (
    <div
      className={`card flex h-full items-start gap-4 transition ${
        soon ? "opacity-60" : "hover:border-brand-500 hover:shadow-md"
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {soon && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              בקרוב
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{desc}</p>
      </div>
    </div>
  );

  if (soon || !href) {
    return (
      <div aria-disabled="true" className="cursor-default">
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="text-xl font-bold text-gray-900">{children}</h2>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

export default async function HomePage() {
  const session = await getSession();
  const staff = session ? isStaff(session.user.role) : false;

  return (
    <div className="min-h-screen">
      <SiteHeader session={session} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Hero */}
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Logo className="mb-6 h-24 w-auto" />
            <h1 className="text-4xl font-bold leading-tight text-gray-900">מידע ושירות לתושב</h1>
            <p className="mt-4 text-lg text-gray-600">
              מידע שימושי לחברי הישוב ופנייה לצוות החצר — במקום אחד.
            </p>

            {!session && (
              <div className="mt-8">
                <Link href="/login" className="btn-primary">
                  כניסה / רישום
                </Link>
                <p className="mt-3 text-sm text-gray-500">
                  השירותים פתוחים לחברי הישוב לאחר כניסה למערכת.
                </p>
              </div>
            )}
          </div>

          {/* Temporary hero image — to be replaced. */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <Image
              src="/hero.svg"
              alt="איור של מבני הקיבוץ"
              width={800}
              height={450}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>

        {/* מידע לתושב — all coming soon for now */}
        <section className="mt-14">
          <SectionTitle>מידע לתושב</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              soon
              icon="🗺️"
              title="חפש בית בישוב"
              desc="מציאת בית של משפחה על מפת הישוב."
            />
            <Tile
              soon
              icon="📞"
              title="חפש מספר טלפון"
              desc="ספר טלפונים של חברי הישוב."
            />
            <Tile soon icon="🔗" title="קו העירוב" desc="סטטוס העירוב לשבת." />
            <Tile soon icon="🕰️" title="זמני תפילות" desc="זמני התפילות בישוב." />
          </div>
        </section>

        {/* פנייה לצוות חצר — the existing maintenance features */}
        <section className="mt-12">
          <SectionTitle>פנייה לצוות חצר</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile
              href="/faults/new"
              icon="🔧"
              title="פתיחת קריאה לתקלה"
              desc="דיווח על תקלה במבנה. הטיפול יתועד עד לסגירה."
            />
            <Tile
              href="/faults"
              icon="📋"
              title={staff ? "ניהול תקלות" : "מעקב סטטוס קריאה"}
              desc={
                staff
                  ? "צפייה בכל הקריאות, סינון, עדכון סטטוס וטיפול."
                  : "מעקב אחר הקריאות שדיווחת, משלב הפתיחה ועד לסגירה."
              }
            />
            {session?.user.role === "admin" && (
              <Tile
                href="/admin"
                icon="⚙️"
                title="ניהול מערכת"
                desc="ניהול משתמשים, תושבים ומבנים."
              />
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        קהילת עצמונה-שומריה — מידע ושירות לתושב
      </footer>
    </div>
  );
}
